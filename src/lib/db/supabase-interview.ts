import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { analysisSchema, type Analysis } from "../ai/analysis";
import type { ChatMessage, DictionaryEntry } from "../ai/claude";
import type { InterviewRepository, InterviewRecipe, PublishResult, SensoryCase, StoredMessage } from "./interview";
import { recipeMediaUrl } from "../recipes/media";
import { InterviewError } from "../services/errors";

function check(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("S04_STALE_ANALYSIS")) throw new InterviewError(409, "STALE_ANALYSIS", "대화가 갱신됐습니다. 다시 분석해 주세요");
  if (error.message.includes("S04_NOT_DRAFT")) throw new InterviewError(409, "NOT_DRAFT", "수정 가능한 초안이 아닙니다");
  if (error.message.includes("S04_SENSORY_INSUFFICIENT")) throw new InterviewError(422, "SENSORY_INSUFFICIENT", "감각 항목을 먼저 확인해 주세요");
  throw new Error("INTERVIEW_DATABASE_ERROR");
}
const recipeSchema = z.object({ id: z.string(), transmitter_id: z.string(), status: z.enum(["draft", "published"]), visibility: z.enum(["public", "private"]), transcript: z.string().nullable() });
const publishSchema = z.object({ recipe_id: z.string(), status: z.literal("published"), context_summary: z.string(), voice_message_url: z.string().nullable() });

export class SupabaseInterviewRepository implements InterviewRepository {
  constructor(private db: SupabaseClient) {}
  async getRecipe(owner: string, id: string): Promise<InterviewRecipe | null> {
    const { data, error } = await this.db.from("recipes").select("id,transmitter_id,status,visibility,transcript").eq("id", id).eq("transmitter_id", owner).maybeSingle();
    check(error); return data ? recipeSchema.parse(data) : null;
  }
  private async requireOwned(owner: string, id: string) {
    if (!await this.getRecipe(owner, id)) throw new InterviewError(404, "NOT_FOUND", "레시피를 찾을 수 없습니다");
  }
  async getAnalysis(owner: string, id: string) {
    await this.requireOwned(owner, id);
    const { data, error } = await this.db.from("transmission_cards").select("ai_analysis").eq("recipe_id", id).maybeSingle();
    check(error); if (!data?.ai_analysis?.interview) return null;
    return analysisSchema.parse(data.ai_analysis.interview);
  }
  async listMessages(owner: string, id: string): Promise<StoredMessage[]> {
    await this.requireOwned(owner, id);
    const { data, error } = await this.db.from("chat_messages").select("id,role,content,image_url,audio_url").eq("recipe_id", id).order("s04_sequence");
    check(error);
    const rows = z.array(z.object({ id: z.string(), role: z.enum(["user", "assistant"]), content: z.string(), image_url: z.string().nullable(), audio_url: z.string().nullable() })).parse(data);
    return Promise.all(rows.map(async m => ({ ...m, image_url: m.image_url ? await this.resolveImage(owner, id, m.image_url) : undefined })));
  }
  async listDictionary(owner: string): Promise<DictionaryEntry[]> {
    const { data, error } = await this.db.from("sensory_cases").select("id,expression,dimension,context,food_name,resolved_value,confidence,embedding").eq("transmitter_id", owner).order("created_at");
    check(error);
    const rows = z.array(z.object({ id: z.string(), expression: z.string(), dimension: z.string(), context: z.string(), food_name: z.string(), resolved_value: z.string(), confidence: z.number(), embedding: z.union([z.string(), z.array(z.number())]).nullable() })).parse(data);
    return rows.map(row => ({ ...row, embedding: typeof row.embedding === "string" ? z.array(z.number()).parse(JSON.parse(row.embedding)) : row.embedding,
      confirmations: rows.filter(e => e.expression === row.expression && e.dimension === row.dimension && e.context === row.context && e.food_name === row.food_name && e.resolved_value === row.resolved_value).length,
    }));
  }
  async saveProfileVector(owner: string, vector: number[]) {
    const { data, error } = await this.db.from("profiles").update({ sensory_vector: JSON.stringify(vector), updated_at: new Date().toISOString() }).eq("id", owner).select("id").maybeSingle();
    check(error);
    if (!data) throw new InterviewError(404, "PROFILE_NOT_FOUND", "프로필을 먼저 설정해 주세요");
  }
  async saveAnalysis(owner: string, id: string, a: Analysis, lastMessageId: string | null) {
    const { error } = await this.db.rpc("s04_save_analysis", { p_owner: owner, p_recipe: id, p_analysis: a, p_last_message: lastMessageId }); check(error);
  }
  async appendMessage(owner: string, id: string, m: ChatMessage & { audio_url?: string | null }) {
    const { data, error } = await this.db.rpc("s04_append_message", { p_owner: owner, p_recipe: id, p_role: m.role, p_content: m.content, p_image: m.image_url ?? null, p_audio: m.audio_url ?? null });
    check(error); return z.string().parse(data);
  }
  async addCase(owner: string, item: SensoryCase) {
    await this.requireOwned(owner, item.recipe_id);
    const { error } = await this.db.from("sensory_cases").upsert({ ...item, transmitter_id: owner, embedding: JSON.stringify(item.embedding) }, { onConflict: "message_id,expression,dimension,context", ignoreDuplicates: true }); check(error);
  }
  async countConfirmed(owner: string, id: string) {
    const { count, error } = await this.db.from("sensory_cases").select("id", { count: "exact", head: true }).eq("recipe_id", id).eq("transmitter_id", owner); check(error); return count ?? 0;
  }
  async publish(owner: string, id: string, expectedAnalysis: Analysis): Promise<PublishResult> {
    const { data, error } = await this.db.rpc("s04_publish", { p_owner: owner, p_recipe: id, p_analysis: expectedAnalysis }); check(error); return this.withVoice(owner, id, publishSchema.parse(data));
  }
  async publishedResult(owner: string, id: string): Promise<PublishResult> {
    await this.requireOwned(owner, id);
    const { data, error } = await this.db.from("transmission_cards").select("context_summary,voice_message_url").eq("recipe_id", id).maybeSingle(); check(error);
    return this.withVoice(owner, id, publishSchema.parse({ recipe_id: id, status: "published", context_summary: data?.context_summary ?? "", voice_message_url: data?.voice_message_url ?? null }));
  }
  private async withVoice(owner: string, id: string, result: PublishResult) {
    return { ...result, voice_message_url: await recipeMediaUrl(this.db, result.voice_message_url, "card-voice", `${owner}/${id}`) };
  }
  async storeAudio(owner: string, id: string, name: string, audio: Buffer) {
    await this.requireOwned(owner, id);
    const path = `${owner}/${id}/${name}.mp3`;
    const bucket = this.db.storage.from("tts");
    const { error } = await bucket.upload(path, audio, { contentType: "audio/mpeg", upsert: false }); check(error);
    const { data, error: signError } = await bucket.createSignedUrl(path, 900); check(signError);
    return z.string().parse(data?.signedUrl);
  }
  async resolveImage(owner: string, id: string, path: string) {
    await this.requireOwned(owner, id);
    const pattern = new RegExp(`^${owner}/chat_image/[0-9a-f-]+\\.(jpg|png|webp)$`, "i");
    if (!pattern.test(path)) throw new InterviewError(403, "IMAGE_FORBIDDEN", "본인 채팅 이미지 경로만 사용할 수 있습니다");
    const bucket = this.db.storage.from("uploads");
    const { data: info, error } = await bucket.info(path); check(error);
    if (!info || !Number.isFinite(info.size)) throw new InterviewError(422, "IMAGE_INVALID", "이미지 정보를 확인할 수 없습니다");
    if (info.size! > 10 * 1024 * 1024) throw new InterviewError(413, "IMAGE_TOO_LARGE", "이미지는 10MB 이하로 올려 주세요");
    if (!["image/jpeg", "image/png", "image/webp"].includes(info.contentType ?? "")) throw new InterviewError(415, "IMAGE_TYPE_INVALID", "지원하지 않는 이미지 형식입니다");
    const { data, error: signError } = await bucket.createSignedUrl(path, 900); check(signError);
    return z.string().parse(data?.signedUrl);
  }
}
