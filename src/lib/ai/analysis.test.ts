import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analysisSchema } from "./analysis";
import { analysisFixture } from "./__fakes__/analysis.fixture";
import { ANALYZE_PROMPT, CHAT_PROMPT, INTERVIEW_PROMPT } from "./interview-prompt";

describe("interview analysis contract", () => {
  it("원문의 복합 조리와 미확인 값 형식을 보존한다", () => {
    const result = analysisSchema.parse(analysisFixture());
    expect(result.recipe.ingredients[0].amount).toBeNull();
    expect(result.card.unresolved).toEqual(["소금 양"]);
    expect(result.normalized_transcript).toBe("소금을 쪼매 넣어요.");
  });
  it("즉시 질문을 두 개 이상 생성하면 거부한다", () => {
    const input = analysisFixture();
    input.questions.push({ ...input.questions[0], id: "q2" });
    expect(analysisSchema.safeParse(input).success).toBe(false);
  });
  it("즉시 질문은 P0만 허용한다", () => {
    const input = analysisFixture();
    input.questions[0].priority = "P1";
    expect(analysisSchema.safeParse(input).success).toBe(false);
  });
  it("질문이 없어도 유효하다", () => {
    const input = analysisFixture(); input.questions = [];
    expect(analysisSchema.safeParse(input).success).toBe(true);
  });
  it("프롬프트의 분석 JSON 예시가 스키마에 맞는다", () => {
    const example = INTERVIEW_PROMPT.match(/## 9\. 응답 방식[\s\S]*?\n\n(\{[\s\S]*?\n\})\n\n## 10\./)?.[1];
    expect(example).toBeDefined();
    expect(analysisSchema.safeParse(JSON.parse(example!)).success).toBe(true);
  });
  it("프롬프트 전체에 실행 모드만 덧붙인다", () => {
    expect(createHash("sha256").update(INTERVIEW_PROMPT).digest("hex")).toBe("ac9a40708e7702d49039edd2353507c6d544e2976a71029bfacb09830d903930");
    expect(INTERVIEW_PROMPT).toContain("## 3-2. 복합 레시피 분해 규칙");
    expect(INTERVIEW_PROMPT).toContain("핵심 불확실성이 모두 해결되면 질문 없이 구조화 결과를 반환한다.");
    expect(ANALYZE_PROMPT.startsWith(INTERVIEW_PROMPT)).toBe(true);
    expect(CHAT_PROMPT.startsWith(INTERVIEW_PROMPT)).toBe(true);
  });
});
