import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseInterviewRepository } from "./supabase-interview";
const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/chat_image/22222222-2222-4222-8222-222222222222.png`;
function setup(size = 100, contentType = "image/png") {
  const bucket = { info: vi.fn().mockResolvedValue({ data: { size, contentType }, error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test/image" }, error: null }) };
  const repo = new SupabaseInterviewRepository({ storage: { from: () => bucket } } as unknown as SupabaseClient);
  vi.spyOn(repo, "getRecipe").mockResolvedValue({ id: "recipe", transmitter_id: owner, status: "draft", visibility: "private", transcript: "원문" });
  return { repo, bucket };
}
describe("chat image access", () => {
  it("타인 경로나 URL은 Storage 접근 전에 거부한다", async () => {
    const { repo, bucket } = setup();
    await expect(repo.resolveImage(owner, "recipe", `other/chat_image/image.png`)).rejects.toMatchObject({ status: 403 });
    await expect(repo.resolveImage(owner, "recipe", "https://attacker.test/image.png")).rejects.toMatchObject({ status: 403 });
    expect(bucket.info).not.toHaveBeenCalled();
  });
  it("실제 객체가 10MB를 넘으면 413이며 서명 URL을 발급하지 않는다", async () => {
    const { repo, bucket } = setup(10 * 1024 * 1024 + 1);
    await expect(repo.resolveImage(owner, "recipe", path)).rejects.toMatchObject({ status: 413 });
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
  it("지원하지 않는 객체 형식은 415이다", async () => {
    const { repo } = setup(100, "image/svg+xml");
    await expect(repo.resolveImage(owner, "recipe", path)).rejects.toMatchObject({ status: 415 });
  });
  it("본인 레시피의 허용된 이미지에는 짧은 서명 URL을 발급한다", async () => {
    const { repo, bucket } = setup();
    expect(await repo.resolveImage(owner, "recipe", path)).toBe("https://signed.test/image");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(path, 900);
  });
});

describe("published recipe voice", () => {
  it("저장된 음성 경로를 짧은 서명 URL로 바꿔 반환한다", async () => {
    const bucket = { createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test/voice" }, error: null }) };
    const repo = new SupabaseInterviewRepository({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { context_summary: "가족 식사", voice_message_url: `${owner}/recipe/message.webm` }, error: null }) }) }) }),
      storage: { from: () => bucket },
    } as unknown as SupabaseClient);
    vi.spyOn(repo, "getRecipe").mockResolvedValue({ id: "recipe", transmitter_id: owner, status: "published", visibility: "public", transcript: null });
    expect((await repo.publishedResult(owner, "recipe")).voice_message_url).toBe("https://signed.test/voice");
  });
});
