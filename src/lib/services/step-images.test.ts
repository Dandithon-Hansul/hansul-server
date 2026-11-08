import { describe, expect, it, vi } from "vitest";
import { generateStepImages, type StepImageDependencies } from "./step-images";

function fixture() {
  return {
    read: vi.fn<StepImageDependencies["read"]>().mockResolvedValue({
      title: "안동찜닭",
      status: "published",
      steps: [
        { order: 2, title: "완성", description: "그릇에 담는다" },
        { order: 1, title: "준비", description: "재료를 손질한다", image_url: "existing.webp" },
        { order: 3, title: "마무리", description: "고명을 얹는다" },
      ],
    }),
    generate: vi.fn<StepImageDependencies["generate"]>().mockResolvedValue(Buffer.from("webp")),
    save: vi.fn<StepImageDependencies["save"]>().mockImplementation(async (_owner, _id, order) => order + ".webp"),
    url: vi.fn<StepImageDependencies["url"]>().mockImplementation(async (_owner, _id, path) => "https://example.com/" + path),
  };
}

describe("generateStepImages", () => {
  it("마지막 단계도 생성하며 이미 저장된 이미지는 재사용한다", async () => {
    const d = fixture();
    const result = await generateStepImages(d, "owner", "recipe");
    expect(result.generated.map(({ order }) => order)).toEqual([1, 2, 3]);
    expect(result.failed_orders).toEqual([]);
    expect(d.generate).toHaveBeenCalledTimes(2);
    expect(d.generate).toHaveBeenCalledWith(expect.stringContaining("완성된 요리"));
    expect(d.save).toHaveBeenCalledWith("owner", "recipe", 3, expect.any(Buffer));
  });

  it("부분 실패 시 성공한 결과를 반환한다", async () => {
    const d = fixture();
    d.generate.mockRejectedValueOnce(new Error("provider timeout"));
    const result = await generateStepImages(d, "owner", "recipe");
    expect(result.generated.map(({ order }) => order)).toEqual([1, 3]);
    expect(result.failed_orders).toEqual([2]);
  });

  it("초안은 생성하지 않는다", async () => {
    const d = fixture();
    d.read.mockResolvedValue({ title: null, status: "draft", steps: [] });
    await expect(generateStepImages(d, "owner", "recipe")).rejects.toMatchObject({ status: 422 });
    expect(d.generate).not.toHaveBeenCalled();
  });
});
