import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ClaudeAdapter } from "./claude-adapter";
import { analysisFixture } from "./__fakes__/analysis.fixture";
const input = { transcript: "소금 쪼매", dictionary: [], history: [] };
function reply(text: string, stop_reason = "end_turn") { return { content: [{ type: "text", text }], stop_reason }; }
function adapter(create: ReturnType<typeof vi.fn>) {
  return new ClaudeAdapter({ messages: { create } } as unknown as Anthropic, "test-model");
}
describe("ClaudeAdapter", () => {
  it("전체 분석 JSON을 검증하고 시스템 프롬프트 캐시를 요청한다", async () => {
    const create = vi.fn().mockResolvedValue(reply(JSON.stringify(analysisFixture())));
    const result = await adapter(create).analyzeJson(input);
    expect(result.recipe.food_types).toEqual(["나물"]);
    expect(create.mock.calls[0][0].system[0].cache_control).toEqual({ type: "ephemeral" });
  });
  it("형식 오류만 한 번 재시도한다", async () => {
    const create = vi.fn().mockResolvedValueOnce(reply("설명문")).mockResolvedValueOnce(reply(JSON.stringify(analysisFixture())));
    await adapter(create).analyzeJson(input);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("계속 잘못된 JSON이면 저장 가능한 결과를 반환하지 않는다", async () => {
    const create = vi.fn().mockResolvedValue(reply("{}"));
    await expect(adapter(create).analyzeJson(input)).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("네트워크 오류는 형식 재시도로 중복 호출하지 않는다", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network"));
    await expect(adapter(create).analyzeJson(input)).rejects.toThrow("network");
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("토큰 한도로 잘린 JSON을 사용하지 않는다", async () => {
    const create = vi.fn().mockResolvedValue(reply(JSON.stringify(analysisFixture()), "max_tokens"));
    await expect(adapter(create).analyzeJson(input)).rejects.toThrow("AI_ANALYSIS_INCOMPLETE");
  });
});
