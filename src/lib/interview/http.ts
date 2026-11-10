import { after } from "next/server";
import { z } from "zod";
import type { InterviewRepository } from "../db/interview";
import type { ClaudePort } from "../ai/claude";
import type { EmbeddingPort } from "../ai/embedding";
import type { TtsPort } from "../ai/tts";
import { analyzeRecipe } from "../services/analyze";
import { chatRecipe } from "../services/chat";
import { publishRecipe } from "../services/publish";
import { vectorizeProfile } from "../services/vectorize";
import { InterviewError } from "../services/errors";
import { recipeError, recipeJson } from "../recipes/http";
import { sse } from "../sse";

export interface InterviewDependencies { userId: string | null; repo: InterviewRepository; ai: ClaudePort; embedding: EmbeddingPort; tts: TtsPort }
const recipeInput = z.object({ recipe_id: z.uuid() }).strict();
const publishInput = recipeInput.extend({ transmitter_quote: z.string().trim().min(1).max(300).optional() });
const chatInput = z.object({ recipe_id: z.uuid(), message: z.string().trim().min(1).max(8000), image_path: z.string().max(500).optional(), tts: z.boolean().default(false) }).strict();
async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = await request.json(); } catch { throw new InterviewError(400, "INVALID_JSON", "JSON 형식을 확인해 주세요"); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new InterviewError(422, "INVALID_INPUT", "요청 필드를 확인해 주세요");
  return parsed.data;
}
export function interviewFailure(error: unknown, stage = "request") {
  const failure = error instanceof InterviewError ? error : error instanceof Error && error.message === "INTERVIEW_DATABASE_ERROR"
    ? new InterviewError(502, "INTERVIEW_DATABASE_ERROR", "레시피 처리에 실패했습니다. 잠시 후 다시 시도해 주세요") : null;
  if (!failure || failure.status >= 500) console.error("interview request failed", { stage, code: failure?.code ?? "INTERVIEW_FAILED" });
  return failure ? recipeError(failure.status, failure.code, failure.message) : recipeError(502, "INTERVIEW_FAILED", "인터뷰 처리에 실패했습니다. 잠시 후 다시 시도해 주세요");
}
export function createInterviewHandlers(d: InterviewDependencies) {
  function owner() {
    if (!d.userId) throw new InterviewError(401, "UNAUTHORIZED", "인증이 필요합니다");
    return d.userId;
  }
  return {
    async analyze(request: Request) {
      try { const user = owner(); const input = await body(request, recipeInput); return recipeJson(await analyzeRecipe(d.repo, d.ai, d.embedding, user, input.recipe_id)); }
      catch (error) { return interviewFailure(error, "analyze"); }
    },
    async publish(request: Request) {
      try { const user = owner(); const input = await body(request, publishInput); return recipeJson(await publishRecipe(d.repo, user, input.recipe_id, { quote: input.transmitter_quote, tts: d.tts })); }
      catch (error) { return interviewFailure(error, "publish"); }
    },
    async vectorize(request: Request) {
      try { const user = owner(); await body(request, z.object({}).strict()); return recipeJson(await vectorizeProfile(d.repo, d.embedding, user)); }
      catch (error) { return interviewFailure(error, "vectorize"); }
    },
    async chat(request: Request) {
      try {
        const user = owner(); const input = await body(request, chatInput);
        const abort = new AbortController();
        const onAbort = () => abort.abort();
        request.signal.addEventListener("abort", onAbort, { once: true });
        if (request.signal.aborted) abort.abort();
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (frame: string) => { if (!abort.signal.aborted) controller.enqueue(encoder.encode(frame)); };
            try { await chatRecipe(d.repo, d.ai, d.tts, d.embedding, user, input, send, abort.signal, job => after(job)); }
            catch (error) {
              const code = error instanceof InterviewError ? error.code : error instanceof Error && error.message === "INTERVIEW_DATABASE_ERROR" ? "INTERVIEW_DATABASE_ERROR" : "INTERVIEW_FAILED";
              console.error("interview chat failed", { stage: "stream", code });
              send(sse("error", { code, message: "답변 처리를 완료하지 못했습니다. 다시 시도해 주세요" }));
            }
            finally { request.signal.removeEventListener("abort", onAbort); if (!abort.signal.aborted) controller.close(); }
          },
          cancel() { abort.abort(); },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-cache, no-store", "X-Accel-Buffering": "no" } });
      } catch (error) { return interviewFailure(error, "chat_setup"); }
    },
  };
}
