import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseInterviewRepository } from "./supabase-interview";
const owner = "11111111-1111-4111-8111-111111111111";
const path = `${owner}/chat_image/22222222-2222-4222-8222-222222222222.png`;
function setup(size = 100, contentType = "image/png", grantOverride: Record<string, unknown> | null = {}) {
  const bucket = { info: vi.fn().mockResolvedValue({ data: { size, contentType }, error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test/image" }, error: null }) };
  const grant = grantOverride === null ? null : { bucket: "uploads", path, owner_id: owner, recipe_id: "recipe", purpose: "chat_image", content_type: "image/png", size_bytes: 100, ...grantOverride };
  const filters: Record<string, unknown> = {};
  const query = {
    eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return query; }),
    maybeSingle: vi.fn(async () => ({ data: grant && Object.entries(filters).every(([key, value]) => grant[key as keyof typeof grant] === value) ? grant : null, error: null })),
  };
  const repo = new SupabaseInterviewRepository({ from: () => ({ select: () => query }), storage: { from: () => bucket } } as unknown as SupabaseClient);
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
  it.each([null, { recipe_id: "other-recipe" }, { purpose: "stt_audio" }, { owner_id: "other-owner" }, { bucket: "other-bucket" }])("발급 기록이 없거나 대상·용도가 다르면 거부한다: %j", async grant => {
    const { repo, bucket } = setup(100, "image/png", grant);
    await expect(repo.resolveImage(owner, "recipe", path)).rejects.toMatchObject({ status: 403, code: "UPLOAD_NOT_GRANTED" });
    expect(bucket.info).not.toHaveBeenCalled(); expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
  it.each([[101, "image/png"], [100, "image/jpeg"]])("실제 크기·형식이 발급 기록과 다르면 거부한다", async (size, type) => {
    const { repo, bucket } = setup(size, type);
    await expect(repo.resolveImage(owner, "recipe", path)).rejects.toMatchObject({ status: 422, code: "UPLOAD_MISMATCH" });
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
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

describe("profile vector ownership", () => {
  it("인증된 사용자 ID로만 프로필 벡터를 갱신한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: owner }, error: null });
    const eq = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    const update = vi.fn().mockReturnValue({ eq });
    const repo = new SupabaseInterviewRepository({ from: () => ({ update }) } as unknown as SupabaseClient);
    const vector = Array(1536).fill(0.1);
    await repo.saveProfileVector(owner, vector);
    expect(eq).toHaveBeenCalledWith("id", owner);
    expect(update.mock.calls[0][0].sensory_vector).toBe(JSON.stringify(vector));
  });
  it("프로필이 없으면 성공으로 반환하지 않는다", async () => {
    const repo = new SupabaseInterviewRepository({ from: () => ({ update: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) } as unknown as SupabaseClient);
    await expect(repo.saveProfileVector(owner, Array(1536).fill(0.1))).rejects.toMatchObject({ status: 404, code: "PROFILE_NOT_FOUND" });
  });
});
