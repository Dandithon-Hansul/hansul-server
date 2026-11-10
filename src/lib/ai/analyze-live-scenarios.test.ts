import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { analysisSchema } from "./analysis";
import { ClaudeAdapter } from "./claude-adapter";
import type { AnalyzeInput } from "./claude";

const scenarios: { id: string; input: AnalyzeInput; check: (result: Awaited<ReturnType<ClaudeAdapter["analyzeJson"]>>) => void }[] = [
  {
    id: "A1 clear single recipe",
    input: { transcript: "무를 썰고 간장 두 숟가락과 물을 자작하게 넣어 중불에서 10분 졸인다.", dictionary: [], history: [] },
    check: result => {
      expect(result.recipe.ingredients.length).toBeGreaterThan(0);
      expect(result.recipe.steps.length).toBeGreaterThan(0);
    },
  },
  {
    id: "A2 ambiguous amount and sensory term",
    input: { transcript: "콩나물을 데쳐서 소금 쪼매 넣고 참기름 한 바퀴 둘러 무쳐요.", dictionary: [], history: [] },
    check: result => {
      expect(result.detected_sensory_terms.length + result.card.unresolved.length).toBeGreaterThan(0);
    },
  },
  {
    id: "A3 multi component recipe",
    input: { transcript: "비빔밥을 해요. 밥은 따로 짓고 시금치는 데쳐 무쳐요. 고추장 한 숟가락과 참기름으로 양념장을 만들어 마지막에 모두 섞어요.", dictionary: [], history: [] },
    check: result => {
      expect(result.recipe.components.length).toBeGreaterThan(0);
      expect(result.recipe.steps.length).toBeGreaterThan(1);
    },
  },
  {
    id: "A4 confirmed history",
    input: {
      transcript: "감자를 썰어 물을 자작하게 붓고 졸여요.", dictionary: [],
      history: [
        { role: "assistant", content: "자작하게가 어느 정도예요?" },
        { role: "user", content: "감자가 반쯤 잠길 정도예요." },
      ],
    },
    check: result => {
      expect([...result.questions, ...result.pending_questions].some(q => q.expression === "자작하게" && q.ask_now)).toBe(false);
    },
  },
];

describe.skipIf(process.env.ANTHROPIC_LIVE !== "1")("Anthropic live analyze scenarios", () => {
  for (const scenario of scenarios) {
    it(scenario.id, async () => {
      const client = new Anthropic({ maxRetries: 0 });
      const create = vi.spyOn(client.messages, "create");
      const start = Date.now();
      try {
        const result = await new ClaudeAdapter(client).analyzeJson(scenario.input);
        expect(analysisSchema.safeParse(result).success).toBe(true);
        expect(create.mock.calls.length).toBeLessThanOrEqual(3);
        expect(result.questions.filter(q => q.ask_now && q.priority === "P0").length).toBeLessThanOrEqual(1);
        expect(result.pending_questions.every(q => !q.ask_now)).toBe(true);
        scenario.check(result);
        console.log(JSON.stringify({ scenario: scenario.id, ok: true, calls: create.mock.calls.length, duration_ms: Date.now() - start }));
      } catch (error) {
        console.log(JSON.stringify({ scenario: scenario.id, ok: false, calls: create.mock.calls.length, duration_ms: Date.now() - start, code: error instanceof Error && "code" in error ? error.code : null }));
        throw error;
      }
    }, 180000);
  }
});
