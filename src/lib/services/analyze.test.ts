import { describe, expect, it, vi } from "vitest";
import { analyzeRecipe } from "./analyze";
import { analysisFixture } from "../ai/__fakes__/analysis.fixture";
import { FakeClaude } from "../ai/__fakes__/claude.fake";
import { FakeEmbedding } from "../ai/__fakes__/embedding.fake";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";

describe("analyzeRecipe", () => {
  it("소유자 초안을 구조화하고 내부 자료는 반환하지 않는다", async () => {
    const repo = new FakeInterviewRepository();
    const result = await analyzeRecipe(repo, new FakeClaude(), new FakeEmbedding(), "owner", "recipe");
    expect(result.structured.steps[0].action).toBe("소금을 넣고 무쳐요.");
    expect(JSON.stringify(result)).not.toContain("normalized_transcript");
    expect(repo.analysis?.card.unresolved).toEqual(["소금 양"]);
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
