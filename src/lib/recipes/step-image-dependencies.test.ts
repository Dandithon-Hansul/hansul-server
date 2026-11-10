import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({
  createSupabaseAdminClient: () => ({ storage: { from: () => ({}) } }),
}));
vi.mock("openai", () => ({
  default: class {
    images = { generate: mocks.generate };
  },
}));

import { stepImageDependencies } from "./step-image-dependencies";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("stepImageDependencies.generate", () => {
  it("IMAGE_MODEL이 없으면 지원되는 기본 모델로 이미지를 생성한다", async () => {
    vi.stubEnv("IMAGE_MODEL", undefined);
    mocks.generate.mockResolvedValue({ data: [{ b64_json: Buffer.from("webp").toString("base64") }] });

    const image = await stepImageDependencies().generate("조리 사진");

    expect(image).toEqual(Buffer.from("webp"));
    expect(mocks.generate).toHaveBeenCalledWith({ model: "gpt-image-1.5", prompt: "조리 사진", output_format: "webp" });
  });

  it.each(["gpt-image-1", "dall-e-2", "dall-e-3"])("종료된 %s 모델 설정은 지원되는 모델로 대체한다", async (configuredModel) => {
    vi.stubEnv("IMAGE_MODEL", configuredModel);
    mocks.generate.mockResolvedValue({ data: [{ b64_json: Buffer.from("webp").toString("base64") }] });

    await stepImageDependencies().generate("조리 사진");

    expect(mocks.generate).toHaveBeenCalledWith({ model: "gpt-image-1.5", prompt: "조리 사진", output_format: "webp" });
  });

  it("지원되는 이미지 모델 설정은 그대로 사용한다", async () => {
    vi.stubEnv("IMAGE_MODEL", "gpt-image-2");
    mocks.generate.mockResolvedValue({ data: [{ b64_json: Buffer.from("webp").toString("base64") }] });

    await stepImageDependencies().generate("조리 사진");

    expect(mocks.generate).toHaveBeenCalledWith({ model: "gpt-image-2", prompt: "조리 사진", output_format: "webp" });
  });
});
