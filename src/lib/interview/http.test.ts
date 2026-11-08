import { describe, expect, it } from "vitest";
import { createInterviewHandlers } from "./http";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";
import { FakeClaude } from "../ai/__fakes__/claude.fake";
import { FakeEmbedding } from "../ai/__fakes__/embedding.fake";
import { FakeTts } from "../ai/__fakes__/tts.fake";
const id = "11111111-1111-4111-8111-111111111111";
function setup(userId: string | null = "owner") {
  const repo = new FakeInterviewRepository(); repo.recipe.id = id;
  return createInterviewHandlers({ userId, repo, ai: new FakeClaude(), tts: new FakeTts(), embedding: new FakeEmbedding() });
}
function req(body: unknown) { return new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }); }
describe("interview HTTP", () => {
  it("미인증 요청은 401이다", async () => {
    expect((await setup(null).analyze(req({ recipe_id: id }))).status).toBe(401);
  });
  it("recipe_id가 없으면 SSE를 시작하기 전에 422를 반환한다", async () => {
    const r = await setup().chat(req({ message: "답변" }));
    expect(r.status).toBe(422); expect(r.headers.get("content-type")).toContain("application/json");
  });
  it("유효하지 않은 JSON은 400이다", async () => {
    const r = await setup().analyze(new Request("http://localhost", { method: "POST", body: "{" }));
    expect(r.status).toBe(400);
  });
  it("분석 결과는 no-store JSON이며 내부 원문이 없다", async () => {
    const r = await setup().analyze(req({ recipe_id: id }));
    expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toContain("no-store");
    expect(await r.json()).not.toHaveProperty("normalized_transcript");
  });
  it("정상 채팅은 표준 SSE 프레임을 반환한다", async () => {
    const r = await setup().chat(req({ recipe_id: id, message: "설명해 주세요" }));
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const frames = await r.text(); expect(frames).toContain("event: done\ndata: "); expect(frames).not.toContain("event: audio");
  });
});
