import { describe, expect, it, vi } from "vitest";
import { publishRecipe } from "./publish";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";
import { analysisFixture } from "../ai/__fakes__/analysis.fixture";

describe("publishRecipe", () => {
  it("확정 감각 사례가 없으면 422를 반환한다", async () => {
    const repo = new FakeInterviewRepository(); repo.analysis = analysisFixture();
    await expect(publishRecipe(repo, "owner", "recipe")).rejects.toMatchObject({ status: 422, code: "SENSORY_INSUFFICIENT" });
  });
  it("명시적 확인 사례와 구조화가 있으면 공개 발행하고 재호출은 멱등이다", async () => {
    const repo = new FakeInterviewRepository(); repo.analysis = analysisFixture();
    repo.confirmedCount = 1; repo.analysis.questions = [];
    const first = await publishRecipe(repo, "owner", "recipe");
    expect(repo.recipe.status).toBe("published");
    expect(repo.recipe.visibility).toBe("public");
    expect(await publishRecipe(repo, "owner", "recipe")).toEqual(first);
    expect(repo.publishCalls).toBe(1);
  });
  it("확정 문장으로 음성을 생성하고 재호출 때 덮어쓰지 않는다", async () => {
    const repo = new FakeInterviewRepository();
    repo.analysis = analysisFixture();
    repo.analysis.questions = [];
    repo.confirmedCount = 1;
    const synthesize = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const first = await publishRecipe(repo, "owner", "recipe", { quote: "간은 마지막에 맞춰요.", tts: { synthesize } });
    expect(first).toMatchObject({
      transmitter_quote: "간은 마지막에 맞춰요.",
      voice_message_url: "https://example.test/quote.mp3",
    });
    expect(synthesize).toHaveBeenCalledExactlyOnceWith("간은 마지막에 맞춰요.");
    expect(await publishRecipe(repo, "owner", "recipe", { quote: "다른 문장", tts: { synthesize } })).toEqual(first);
    expect(synthesize).toHaveBeenCalledOnce();
  });

  it("음성 생성 실패 시에도 문장을 저장하고 발행을 유지한다", async () => {
    const repo = new FakeInterviewRepository();
    repo.analysis = analysisFixture();
    repo.analysis.questions = [];
    repo.confirmedCount = 1;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const synthesize = vi.fn().mockRejectedValue(new Error("provider failed"));
      await expect(publishRecipe(repo, "owner", "recipe", { quote: "한 마디", tts: { synthesize } }))
        .resolves.toMatchObject({ status: "published", transmitter_quote: "한 마디", voice_message_url: null });
      expect(repo.quote).toBe("한 마디");
    } finally {
      warn.mockRestore();
    }
  });

  it("타인 레시피를 발행할 수 없다", async () => {
    await expect(publishRecipe(new FakeInterviewRepository(), "stranger", "recipe")).rejects.toMatchObject({ status: 404 });
  });
});
