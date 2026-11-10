import { describe, expect, it } from "vitest";
import { cosine, matchDictionary, confirmedAnswers } from "./sensory";
import { analysisFixture } from "../ai/__fakes__/analysis.fixture";
import type { DictionaryEntry } from "../ai/claude";
const entry: DictionaryEntry = { id: "entry-1", expression: "쪼매", dimension: "salt_intensity", context: "나물 간하기", food_name: "나물무침", resolved_value: "찻숟가락 반", confidence: 0.8, confirmations: 2, embedding: [1, 0] };
const term = analysisFixture().detected_sensory_terms[0];
describe("sensory dictionary", () => {
  it("같은 표현·차원·음식·문맥의 확정 사례를 재사용한다", () => {
    expect(matchDictionary(term, "나물무침", null, [entry])).toEqual(entry);
  });
  it("용기나 조리 문맥이 다르면 재사용하지 않는다", () => {
    expect(matchDictionary({ ...term, context: "큰 냄비에 국 끓이기" }, "나물무침", [1, 0], [entry])).toBeNull();
  });
  it("같은 문맥에서 확정값이 충돌하면 재질문한다", () => {
    expect(matchDictionary(term, "나물무침", null, [entry, { ...entry, resolved_value: "한 숟가락" }])).toBeNull();
  });
  it.each([0.84, 0.85, 0.9])("표현이 다르면 cosine %s의 경계를 적용한다", (similarity) => {
    const query = [similarity, Math.sqrt(1 - similarity ** 2)];
    expect(Boolean(matchDictionary({ ...term, expression: "조금" }, "나물무침", query, [entry]))).toBe(similarity >= 0.85);
  });
  it("영벡터나 차원이 다른 벡터를 일치로 취급하지 않는다", () => {
    expect(cosine([0, 0], [1, 0])).toBe(0);
    expect(cosine([1], [1, 0])).toBe(0);
  });
  it("모델 추정은 확정 사례로 저장하지 않는다", () => {
    const a = analysisFixture(); a.detected_sensory_terms[0].needs_confirmation = false;
    a.detected_sensory_terms[0].interpreted_value = "한 컵";
    expect(confirmedAnswers(a, analysisFixture(), "몰라요")).toEqual([]);
  });
  it("이전 질문에 사용자가 직접 답한 원문만 확정 사례로 추출한다", () => {
    const a = analysisFixture();
    Object.assign(a.detected_sensory_terms[0], { needs_confirmation: false, source: "user_answer", interpreted_value: "찻숟가락 반" });
    expect(confirmedAnswers(a, analysisFixture(), "찻숟가락 반 넣어요")).toHaveLength(1);
  });
});

it("즉시 질문 없이 자발적으로 답한 감각 값도 답변 원문에 있으면 확정한다", () => {
  const analysis = analysisFixture();
  const previous = analysisFixture();
  previous.questions = [];
  Object.assign(analysis.detected_sensory_terms[0], {
    needs_confirmation: false,
    source: "user_answer",
    interpreted_value: "찻숟가락 반",
  });

  expect(confirmedAnswers(analysis, previous, "찻숟가락 반 넣어요")).toHaveLength(1);
  expect(confirmedAnswers(analysis, previous, "조금 넣어요")).toEqual([]);
});
