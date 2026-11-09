import { describe, expect, it, vi } from "vitest";
import { createInterviewHandlers } from "./http";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";
import { FakeClaude } from "../ai/__fakes__/claude.fake";
import { FakeEmbedding } from "../ai/__fakes__/embedding.fake";
import { analysisFixture } from "../ai/__fakes__/analysis.fixture";
import { FakeTts } from "../ai/__fakes__/tts.fake";
const id = "11111111-1111-4111-8111-111111111111";
function setup(userId: string | null = "owner", repo = new FakeInterviewRepository()) {
  repo.recipe.id = id;
  return createInterviewHandlers({ userId, repo, ai: new FakeClaude(), tts: new FakeTts(), embedding: new FakeEmbedding() });
}
function req(body: unknown) { return new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }); }
describe("interview HTTP", () => {
  it("발행 요청은 선택 입력인 한 마디를 검증하고 공백을 정리한다", async () => {
    const repo = new FakeInterviewRepository();
    repo.analysis = analysisFixture();
    repo.analysis.questions = [];
    repo.confirmedCount = 1;
    const handlers = setup("owner", repo);
    expect((await handlers.publish(req({ recipe_id: id, transmitter_quote: " " }))).status).toBe(422);
    expect((await handlers.publish(req({ recipe_id: id, transmitter_quote: "가".repeat(301) }))).status).toBe(422);
    const response = await handlers.publish(req({ recipe_id: id, transmitter_quote: "  간은 마지막에 맞춰요.  " }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      transmitter_quote: "간은 마지막에 맞춰요.",
      voice_message_url: "https://example.test/quote.mp3",
    });
  });
  it("발행 저장 실패를 분석 오류와 구분할 수 있는 코드로 반환한다", async () => {
    const repo = new FakeInterviewRepository(); repo.analysis = analysisFixture(); repo.analysis.questions = []; repo.confirmedCount = 1;
    vi.spyOn(repo, "publish").mockRejectedValue(new Error("INTERVIEW_DATABASE_ERROR"));
    const r = await setup("owner", repo).publish(req({ recipe_id: id }));
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ code: "INTERVIEW_DATABASE_ERROR" });
  });

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
  it("채팅 중 AI 실패 시 SSE에 안정적인 오류 코드를 보낸다", async () => {
    const ai = new FakeClaude();
    const repo = new FakeInterviewRepository(); repo.recipe.id = id;
    vi.spyOn(ai, "chatStream").mockRejectedValue(new Error("upstream secret detail"));
    const handlers = createInterviewHandlers({ userId: "owner", repo, ai, tts: new FakeTts(), embedding: new FakeEmbedding() });
    const r = await handlers.chat(req({ recipe_id: id, message: "테스트" }));
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('"code":"INTERVIEW_FAILED"');
  });
  it("채팅 메시지 DB 저장 실패를 INTERVIEW_DATABASE_ERROR로 구분한다", async () => {
    const repo = new FakeInterviewRepository(); repo.recipe.id = id;
    vi.spyOn(repo, "appendMessage").mockRejectedValue(new Error("INTERVIEW_DATABASE_ERROR"));
    const r = await setup("owner", repo).chat(req({ recipe_id: id, message: "테스트" }));
    expect(await r.text()).toContain('"code":"INTERVIEW_DATABASE_ERROR"');
  });
  it("레시피가 없으면 SSE 스트림에서 에러 이벤트를 반환한다", async () => {
    const unknownId = "00000000-0000-4000-8000-000000000000";
    const r = await setup().chat(req({ recipe_id: unknownId, message: "테스트" }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    expect(await r.text()).toContain("event: error");
  });
  it("정상 채팅에서 레시피를 한 번만 조회한다", async () => {
    const repo = new FakeInterviewRepository();
    const getRecipe = vi.spyOn(repo, "getRecipe");
    const r = await setup("owner", repo).chat(req({ recipe_id: id, message: "설명해 주세요" }));
    expect(getRecipe).toHaveBeenCalledTimes(1);
    await r.text();
  });
  it("벡터화는 인증이 필요하며 확정 사례가 없으면 422이다", async () => {
    expect((await setup(null).vectorize(req({}))).status).toBe(401);
    const r = await setup().vectorize(req({}));
    expect(r.status).toBe(422); expect(await r.json()).toMatchObject({ code: "SENSORY_INSUFFICIENT" });
  });
  it("벡터화 입력으로 타인 ID나 임의 차원값을 받지 않는다", async () => {
    expect((await setup().vectorize(req({ owner: "stranger", dimensions: { salt_intensity: 1 } }))).status).toBe(422);
  });
  it("벡터화 응답은 null 차원을 포함하고 내부 임베딩은 노출하지 않는다", async () => {
    const repo = new FakeInterviewRepository();
    repo.dictionary = [{ id: "case", expression: "쪼매", dimension: "salt_intensity", context: "나물 간하기", food_name: "나물무침", resolved_value: "찻숟가락 반", confidence: 0.6, confirmations: 1, embedding: null }];
    const r = await setup("owner", repo).vectorize(req({}));
    expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toContain("no-store");
    const result = await r.json(); expect(Object.values(result.dimensions)).toEqual([null, null, null, null, null]);
    expect(result.vector_updated).toBe(true); expect(result).not.toHaveProperty("embedding");
  });

});
