import { describe, expect, it, vi } from "vitest";
import { chatRecipe } from "./chat";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";
import { FakeClaude } from "../ai/__fakes__/claude.fake";
import { FakeEmbedding } from "../ai/__fakes__/embedding.fake";
import { FakeTts } from "../ai/__fakes__/tts.fake";
import { analysisFixture } from "../ai/__fakes__/analysis.fixture";

describe("chatRecipe", () => {
  it("사용자 메시지 뒤에 응답을 저장하고 done을 보낸다", async () => {
    const repo = new FakeInterviewRepository(); const frames: string[] = [];
    await chatRecipe(repo, new FakeClaude(), new FakeTts(), new FakeEmbedding(), "owner", { recipe_id: "recipe", message: "찻숟가락이요", tts: false }, s => frames.push(s));
    expect(repo.messages.map(m => m.role)).toEqual(["user", "assistant"]);
    expect(frames[0]).toContain("event: chunk");
    expect(frames.at(-1)).toContain("event: done");
    expect(frames.join("")).not.toContain("event: audio");
  });
  it("TTS는 텍스트 생성을 막지 않고 문장 순서대로 음성을 보낸다", async () => {
    const repo = new FakeInterviewRepository(); const ai = new FakeClaude(); const tts = new FakeTts();
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(tts, "synthesize").mockImplementation(async () => { await gate; return Buffer.from("mp3"); });
    vi.spyOn(ai, "chatStream").mockImplementation(async (_m, _p, chunk) => { chunk("첫 문장. "); chunk("둘째 문장?"); release(); return "첫 문장. 둘째 문장?"; });
    const frames: string[] = [];
    await chatRecipe(repo, ai, tts, new FakeEmbedding(), "owner", { recipe_id: "recipe", message: "설명", tts: true }, s => frames.push(s));
    expect(frames.slice(0, 2).every(f => f.startsWith("event: chunk"))).toBe(true);
    expect(frames.filter(f => f.startsWith("event: audio")).map(f => JSON.parse(f.split("data: ")[1]).sequence)).toEqual([1, 2]);
    expect(repo.messages[1].audio_url).toContain("full");
  });
  it("한 청크 안의 여러 문장과 청크 사이 소수점을 구분한다", async () => {
    const repo = new FakeInterviewRepository(); const ai = new FakeClaude(); const tts = new FakeTts();
    const synth = vi.spyOn(tts, "synthesize");
    vi.spyOn(ai, "chatStream").mockImplementation(async (_m, _p, chunk) => {
      chunk("소금 0."); chunk("5g이에요. 다음 문장. 마지막 문장?"); return "소금 0.5g이에요. 다음 문장. 마지막 문장?";
    });
    await chatRecipe(repo, ai, tts, new FakeEmbedding(), "owner", { recipe_id: "recipe", message: "설명", tts: true }, () => {});
    expect(synth.mock.calls.map(c => c[0])).toEqual(["소금 0.5g이에요.", "다음 문장.", "마지막 문장?", "소금 0.5g이에요. 다음 문장. 마지막 문장?"]);
  });
  it("이미지 소유권 확인 실패 시 메시지를 저장하지 않는다", async () => {
    const repo = new FakeInterviewRepository(); vi.spyOn(repo, "resolveImage").mockRejectedValue(new Error("forbidden"));
    await expect(chatRecipe(repo, new FakeClaude(), new FakeTts(), new FakeEmbedding(), "owner", { recipe_id: "recipe", message: "사진", image_path: "other/file.png", tts: false }, () => {})).rejects.toThrow();
    expect(repo.messages).toEqual([]);
  });
  it("분석이 완료되기 전에 done을 보낸다", async () => {
    const repo = new FakeInterviewRepository();
    const ai = new FakeClaude();
    vi.spyOn(ai, "analyzeJson").mockReturnValue(new Promise(() => {})); // 절대 resolve 안 됨
    const frames: string[] = [];
    await chatRecipe(repo, ai, new FakeTts(), new FakeEmbedding(), "owner",
      { recipe_id: "recipe", message: "테스트", tts: false }, s => frames.push(s));
    expect(frames.at(-1)).toContain("event: done");
  }, 500);
  it("사용자가 직접 확인한 답변은 background 분석 완료 후 저장된다", async () => {
    const repo = new FakeInterviewRepository(); repo.analysis = analysisFixture();
    const ai = new FakeClaude(); const a = analysisFixture(); a.questions = []; a.card.unresolved = [];
    Object.assign(a.detected_sensory_terms[0], { source: "user_answer", interpreted_value: "찻숟가락 반", needs_confirmation: false });
    vi.spyOn(ai, "analyzeJson").mockResolvedValue(a);
    await chatRecipe(repo, ai, new FakeTts(), new FakeEmbedding(), "owner", { recipe_id: "recipe", message: "찻숟가락 반 넣어요", tts: false }, () => {});
    await new Promise(r => setTimeout(r, 0)); // background 분석 태스크 대기
    expect(repo.cases[0]).toMatchObject({ resolved_value: "찻숟가락 반", evidence: "찻숟가락 반 넣어요", message_id: "message-1" });
  });
});
