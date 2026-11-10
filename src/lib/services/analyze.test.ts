import { describe, expect, it, vi } from "vitest";
import { analyzeRecipe } from "./analyze";
import { analysisFixture } from "../ai/__fakes__/analysis.fixture";
import { FakeClaude } from "../ai/__fakes__/claude.fake";
import { FakeEmbedding } from "../ai/__fakes__/embedding.fake";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";
import type { ClaudePort } from "../ai/claude";

describe("analyzeRecipe", () => {
  it("DB 조회·AI·후처리·저장 구간의 시간을 기록한다", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await analyzeRecipe(new FakeInterviewRepository(), new FakeClaude(), new FakeEmbedding(), "owner", "recipe");
      expect(log).toHaveBeenCalledWith("recipe analysis timing", expect.objectContaining({
        recipe_ms: expect.any(Number), lookup_ms: expect.any(Number), ai_ms: expect.any(Number),
        postprocess_ms: expect.any(Number), save_ms: expect.any(Number), total_ms: expect.any(Number),
      }));
    } finally { log.mockRestore(); }
  });
  it("모델 입력에서 임베딩을 제외하고 서버 사전 매칭에는 보존한다", async () => {
    const repo = new FakeInterviewRepository();
    const ai = new FakeClaude();
    repo.dictionary = [{ id: "case-1", expression: "쪼매", dimension: "salt_intensity", context: "나물 간하기", food_name: "나물무침", resolved_value: "찻숟가락 반", confidence: 0.6, confirmations: 1, embedding: [0.1, 0.2] }];
    const analyze = vi.spyOn(ai as ClaudePort, "analyzeJson");

    await analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe");

    expect(analyze.mock.calls[0][0].dictionary[0]).not.toHaveProperty("embedding");
    expect(JSON.stringify(analyze.mock.calls[0][0]).length).toBeLessThan(JSON.stringify({
      ...analyze.mock.calls[0][0], dictionary: repo.dictionary,
    }).length);
    expect(repo.analysis?.auto_applied[0]).toMatchObject({ dictionary_entry_id: "case-1", applied_value: "찻숟가락 반" });
    expect(repo.dictionary[0].embedding).toEqual([0.1, 0.2]);
  });
  it("소유자 초안을 구조화하고 내부 자료는 반환하지 않는다", async () => {
    const repo = new FakeInterviewRepository();
    const result = await analyzeRecipe(repo, new FakeClaude(), new FakeEmbedding(), "owner", "recipe");
    expect(result.structured.steps[0].action).toBe("소금을 넣고 무쳐요.");
    expect(JSON.stringify(result)).not.toContain("normalized_transcript");
    expect(repo.analysis?.card.unresolved).toEqual(["소금 양"]);
  });
  it("P0 질문 없이 채팅에서 확정한 값은 분석 응답 전에 저장한다", async () => {
    const repo = new FakeInterviewRepository();
    const ai = new FakeClaude();
    repo.analysis = analysisFixture();
    repo.analysis.questions = [];
    await repo.appendMessage("owner", "recipe", { role: "user", content: "찻숟가락 반 넣어요" });
    await repo.appendMessage("owner", "recipe", { role: "assistant", content: "확인했어요" });
    const analysis = analysisFixture();
    analysis.questions = [];
    Object.assign(analysis.detected_sensory_terms[0], {
      source: "user_answer", needs_confirmation: false, interpreted_value: "찻숟가락 반",
    });
    vi.spyOn(ai, "analyzeJson").mockResolvedValue(analysis);

    await analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe");

    expect(repo.cases).toHaveLength(1);
    expect(repo.cases[0]).toMatchObject({ message_id: "message-1", resolved_value: "찻숟가락 반" });
  });
  it("타인 초안이나 발행된 레시피는 분석하지 않는다", async () => {
    const repo = new FakeInterviewRepository(); const ai = new FakeClaude();
    const spy = vi.spyOn(ai, "analyzeJson");
    await expect(analyzeRecipe(repo, ai, new FakeEmbedding(), "stranger", "recipe")).rejects.toMatchObject({ status: 404 });
    repo.recipe.status = "published";
    await expect(analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe")).rejects.toMatchObject({ status: 409 });
    expect(spy).not.toHaveBeenCalled();
  });
  it("미확인 모델 수치를 확정 감각 사전에 넣지 않는다", async () => {
    const repo = new FakeInterviewRepository(); const ai = new FakeClaude(); const a = analysisFixture();
    a.detected_sensory_terms[0].interpreted_value = "100g";
    vi.spyOn(ai, "analyzeJson").mockResolvedValue(a);
    await analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe");
    expect(repo.cases).toEqual([]);
    expect(repo.analysis?.detected_sensory_terms[0].interpreted_value).toBeNull();
  });
  it("같은 표현의 다른 문맥이 미확인이면 질문을 일괄 제거하지 않는다", async () => {
    const repo = new FakeInterviewRepository(); const ai = new FakeClaude(); const a = analysisFixture();
    a.detected_sensory_terms.push({ ...a.detected_sensory_terms[0], context: "국에 간하기" });
    repo.dictionary = [{ id: "case-1", expression: "쪼매", dimension: "salt_intensity", context: "나물 간하기", food_name: "나물무침", resolved_value: "찻숟가락 반", confidence: 0.6, confirmations: 1, embedding: null }];
    vi.spyOn(ai, "analyzeJson").mockResolvedValue(a);
    const result = await analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe");
    expect(result.questions).toHaveLength(1);
    expect(result.auto_applied).toEqual([]);
  });

  it("모델이 꾸며낸 사전 ID와 값은 API에 적용하지 않는다", async () => {
    const repo = new FakeInterviewRepository(); const ai = new FakeClaude(); const a = analysisFixture();
    a.auto_applied = [{ expression: "쪼매", dictionary_entry_id: "made-up", applied_value: "한 컵", reason: "추정" }];
    vi.spyOn(ai, "analyzeJson").mockResolvedValue(a);
    expect((await analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe")).auto_applied).toEqual([]);
  });

});

it("이미 다음 채팅이 시작된 백그라운드 분석은 모델을 호출하지 않는다", async () => {
  const repo = new FakeInterviewRepository();
  const ai = new FakeClaude();
  const model = vi.spyOn(ai, "analyzeJson");
  await repo.appendMessage("owner", "recipe", { role: "assistant", content: "이전 질문" });
  await repo.appendMessage("owner", "recipe", { role: "user", content: "새 답변" });

  await expect(analyzeRecipe(repo, ai, new FakeEmbedding(), "owner", "recipe", "message-1"))
    .rejects.toMatchObject({ code: "STALE_ANALYSIS" });
  expect(model).not.toHaveBeenCalled();
});
