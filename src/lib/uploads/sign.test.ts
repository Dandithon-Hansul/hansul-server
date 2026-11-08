import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { signUpload } from "./sign";
const owner = "11111111-1111-4111-8111-111111111111";
const recipe = "22222222-2222-4222-8222-222222222222";
const image = { purpose: "chat_image", recipe_id: recipe, content_type: "image/png", size_bytes: 100 };
function setup(owned = true, status = "draft") {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const eq = vi.fn().mockReturnThis();
  const query = { eq, maybeSingle: vi.fn().mockResolvedValue({ data: owned ? { id: recipe, status } : null, error: null }) };
  const createSignedUploadUrl = vi.fn(async (path: string) => ({ data: { path, token: "test-upload-token" }, error: null }));
  const db = { from: (table: string) => table === "recipes" ? { select: () => query } : { insert }, storage: { from: () => ({ createSignedUploadUrl }) } } as unknown as SupabaseClient;
  eq.mockImplementation(() => query);
  return { db, insert, eq, createSignedUploadUrl };
}
describe("signUpload grant", () => {
  it("미인증 요청에는 발급하지 않는다", async () => {
    const { db, createSignedUploadUrl } = setup();
    expect((await signUpload(null, image, db)).status).toBe(401);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it.each([null, { ...image, size_bytes: -1 }, { ...image, size_bytes: 0 }, { ...image, size_bytes: 0.5 }, { ...image, purpose: "__proto__" }])("잘못된 입력을 거부한다: %j", async input => {
    const { db, createSignedUploadUrl } = setup();
    expect((await signUpload(owner, input, db)).status).toBe(400);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it("다른 사용자의 레시피에는 발급하지 않는다", async () => {
    const { db, eq, createSignedUploadUrl } = setup(false);
    expect((await signUpload(owner, image, db)).status).toBe(404);
    expect(eq).toHaveBeenCalledWith("transmitter_id", owner);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it("발행된 레시피에는 채팅 이미지 토큰을 발급하지 않는다", async () => {
    const { db, createSignedUploadUrl } = setup(true, "published");
    expect((await signUpload(owner, image, db)).status).toBe(409);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it("발급 기록에 소유자·레시피·용도·크기·형식을 저장한 뒤 토큰을 반환한다", async () => {
    const { db, insert } = setup(); const r = await signUpload(owner, image, db);
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(result).toMatchObject({ bucket: "uploads", path: expect.stringMatching(new RegExp(`^${owner}/chat_image/`)), token: "test-upload-token" });
    expect(insert).toHaveBeenCalledWith({ bucket: "uploads", path: result.path, owner_id: owner, recipe_id: recipe, purpose: "chat_image", content_type: "image/png", size_bytes: 100 });
  });
  it("발급 기록 저장 실패 시 토큰을 반환하지 않는다", async () => {
    const { db, insert } = setup(); insert.mockResolvedValue({ error: { message: "database down" } });
    const r = await signUpload(owner, image, db);
    expect(r.status).toBe(500); expect(await r.text()).not.toContain("test-upload-token");
  });
  it("기존 STT 업로드 요청은 레시피 ID 없이 유지한다", async () => {
    const { db, insert } = setup();
    expect((await signUpload(owner, { purpose: "stt_audio", content_type: "audio/webm", size_bytes: 100 }, db)).status).toBe(200);
    expect(insert.mock.calls[0][0]).toMatchObject({ purpose: "stt_audio", recipe_id: null });
  });
  it("stt_audio 25MB 초과는 계속 거부한다", async () => {
    const { db, createSignedUploadUrl } = setup();
    expect((await signUpload(owner, { purpose: "stt_audio", content_type: "audio/webm", size_bytes: 25 * 1024 * 1024 + 1 }, db)).status).toBe(413);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it("stt_audio의 지원하지 않는 형식은 계속 거부한다", async () => {
    const { db, createSignedUploadUrl } = setup();
    const res = await signUpload(owner, { purpose: "stt_audio", content_type: "audio/ogg", size_bytes: 100 }, db);
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("UNSUPPORTED_FORMAT");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it.each([[10 * 1024 * 1024 + 1, "image/png", 413], [100, "image/svg+xml", 415]])("이미지 크기·형식 제한을 유지한다", async (size, type, status) => {
    const { db } = setup();
    expect((await signUpload(owner, { ...image, size_bytes: size, content_type: type }, db)).status).toBe(status);
  });
});
