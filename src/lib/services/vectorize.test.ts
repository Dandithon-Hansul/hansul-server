import { describe, expect, it, vi } from "vitest";
import { vectorizeProfile } from "./vectorize";
import { FakeInterviewRepository } from "../db/__fakes__/interview.fake";
import { FakeEmbedding } from "../ai/__fakes__/embedding.fake";
import type { DictionaryEntry } from "../ai/claude";
const entry: DictionaryEntry = { id: "case-1", expression: "쪼매", dimension: "salt_intensity", context: "나물 간하기", food_name: "나물무침", resolved_value: "찻숟가락 반", confidence: 0.9, confirmations: 2, embedding: null };

describe("vectorizeProfile", () => {
  it("확정 사례가 없으면 422이며 임베딩이나 저장을 실행하지 않는다", async () => {
    const repo = new FakeInterviewRepository(); const embedding = new FakeEmbedding(); const embed = vi.spyOn(embedding, "embed");
    await expect(vectorizeProfile(repo, embedding, "owner")).rejects.toMatchObject({ status: 422, code: "SENSORY_INSUFFICIENT" });
    expect(embed).not.toHaveBeenCalled(); expect(repo.profileVector).toBeNull();
  });
  it("확정 사례만 요약·벡터화하고 미확인 강도는 null로 반환한다", async () => {
    const repo = new FakeInterviewRepository(); repo.dictionary = [entry, { ...entry, id: "unconfirmed", resolved_value: "한 컵", confirmations: 0 }];
    const result = await vectorizeProfile(repo, new FakeEmbedding(), "owner");
    expect(result.profile_summary).toContain("찻숟가락 반"); expect(result.profile_summary).not.toContain("한 컵");
    expect(result.dimensions).toEqual({ salt_intensity: null, liquid_reduction: null, sweet_ratio: null, browning_preference: null, spice_tolerance: null });
    expect(result.vector_updated).toBe(true); expect(repo.profileVector).toHaveLength(1536); expect(repo.vectorOwner).toBe("owner");
  });
  it("confidence나 수량을 맛 강도로 바꾸지 않는다", async () => {
    const repo = new FakeInterviewRepository(); repo.dictionary = [{ ...entry, resolved_value: "0.7g" }];
    expect((await vectorizeProfile(repo, new FakeEmbedding(), "owner")).dimensions.salt_intensity).toBeNull();
  });
  it("반복 확인 사례는 요약에서 중복을 제거하고 서로 다른 문맥은 보존한다", async () => {
    const repo = new FakeInterviewRepository(); repo.dictionary = [entry, { ...entry, id: "repeat" }, { ...entry, id: "other", context: "국 간하기", resolved_value: "한 숟가락" }];
    const result = await vectorizeProfile(repo, new FakeEmbedding(), "owner");
    expect(result.profile_summary.split("\n")).toHaveLength(2);
    expect(result.profile_summary).toContain("나물 간하기"); expect(result.profile_summary).toContain("국 간하기");
  });
  it("잘못된 임베딩은 저장하지 않는다", async () => {
    const repo = new FakeInterviewRepository(); repo.dictionary = [entry]; const embedding = new FakeEmbedding();
    vi.spyOn(embedding, "embed").mockResolvedValue([Number.NaN]);
    await expect(vectorizeProfile(repo, embedding, "owner")).rejects.toThrow(); expect(repo.profileVector).toBeNull();
  });
  it("저장 실패를 성공 응답으로 숨기지 않는다", async () => {
    const repo = new FakeInterviewRepository(); repo.dictionary = [entry];
    vi.spyOn(repo, "saveProfileVector").mockRejectedValue(new Error("database"));
    await expect(vectorizeProfile(repo, new FakeEmbedding(), "owner")).rejects.toThrow("database");
  });
});
