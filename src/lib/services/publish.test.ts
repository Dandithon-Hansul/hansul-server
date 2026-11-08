import { describe, expect, it } from "vitest";
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
  it("타인 레시피를 발행할 수 없다", async () => {
    await expect(publishRecipe(new FakeInterviewRepository(), "stranger", "recipe")).rejects.toMatchObject({ status: 404 });
  });
});
