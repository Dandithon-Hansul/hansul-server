import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUpload } from "./sign";

const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockCreateSignedUploadUrl = vi.fn();
const mockStorage = { from: vi.fn(() => ({ createSignedUploadUrl: mockCreateSignedUploadUrl })) };
const mockDb = { from: mockFrom, storage: mockStorage };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => mockDb,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ insert: mockInsert });
  mockInsert.mockResolvedValue({ error: null });
  mockCreateSignedUploadUrl.mockResolvedValue({
    data: { token: "tok_abc", path: "user1/stt_audio/uuid.webm" },
    error: null,
  });
});

describe("signUpload", () => {
  it("미인증 요청은 401을 반환한다", async () => {
    const res = await signUpload(null, {
      purpose: "stt_audio",
      content_type: "audio/webm",
      size_bytes: 1024,
    });
    expect(res.status).toBe(401);
  });

  it("지원하지 않는 purpose는 400을 반환한다", async () => {
    const res = await signUpload("user1", {
      purpose: "unknown_purpose",
      content_type: "audio/webm",
      size_bytes: 1024,
    });
    expect(res.status).toBe(400);
  });

  it("stt_audio 25MB 초과 시 413을 반환한다", async () => {
    const res = await signUpload("user1", {
      purpose: "stt_audio",
      content_type: "audio/webm",
      size_bytes: 25 * 1024 * 1024 + 1,
    });
    expect(res.status).toBe(413);
  });

  it("stt_audio에서 지원하지 않는 포맷은 415를 반환한다", async () => {
    const res = await signUpload("user1", {
      purpose: "stt_audio",
      content_type: "audio/ogg",
      size_bytes: 1024,
    });
    expect(res.status).toBe(415);
  });

  it("stt_audio는 recipe_id 없이 토큰을 발급한다", async () => {
    const res = await signUpload("user1", {
      purpose: "stt_audio",
      content_type: "audio/webm",
      size_bytes: 1024,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      bucket: expect.any(String),
      path: expect.any(String),
      token: expect.any(String),
    });
  });
});
