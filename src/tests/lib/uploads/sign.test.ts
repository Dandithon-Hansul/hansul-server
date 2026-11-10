import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: vi.fn() }));

import { signUpload } from "@/lib/uploads/sign";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const UID = "11111111-1111-4111-8111-111111111111";
const RECIPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function mockDb(overrides: Record<string, unknown> = {}) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECIPE_ID, status: "draft" }, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: vi.fn().mockImplementation(async (path: string) => ({
          data: { token: "test-token", path }, error: null,
        })),
      }),
    },
    ...overrides,
  } as never);
}

beforeEach(() => vi.resetAllMocks());

describe("signUpload 유효성 검사", () => {
  it("TC-U-09: userId null → 401", async () => {
    const r = await signUpload(null, { purpose: "avatar", content_type: "image/png", size_bytes: 1024 });
    expect(r.status).toBe(401);
  });

  it("TC-U-05: 허용되지 않는 purpose → 400", async () => {
    const r = await signUpload(UID, { purpose: "unknown_type", content_type: "image/png", size_bytes: 1024 });
    expect(r.status).toBe(400);
  });

  it("TC-U-06: size_bytes = 0 (minimum: 1 위반) → 400", async () => {
    const r = await signUpload(UID, { purpose: "avatar", content_type: "image/png", size_bytes: 0 });
    expect(r.status).toBe(400);
  });

  it("TC-U-07: 파일 크기 초과 (avatar > 5MB) → 413", async () => {
    const r = await signUpload(UID, { purpose: "avatar", content_type: "image/png", size_bytes: 6 * 1024 * 1024 });
    expect(r.status).toBe(413);
  });

  it("TC-U-08: 허용되지 않는 content_type (avatar에 audio) → 415", async () => {
    const r = await signUpload(UID, { purpose: "avatar", content_type: "audio/webm", size_bytes: 1024 });
    expect(r.status).toBe(415);
  });

  it("chat_image에 recipe_id 없음 → 400", async () => {
    const r = await signUpload(UID, { purpose: "chat_image", content_type: "image/jpeg", size_bytes: 1024 });
    expect(r.status).toBe(400);
  });
});

describe("signUpload 정상 경로", () => {
  it("TC-U-01: stt_audio → 200, bucket/path/token 반환", async () => {
    mockDb();
    const r = await signUpload(UID, { purpose: "stt_audio", content_type: "audio/webm", size_bytes: 1024 });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.bucket).toBe("uploads");
    expect(body.token).toBeDefined();
  });

  it("TC-U-02: card_voice → 200", async () => {
    mockDb();
    const r = await signUpload(UID, { purpose: "card_voice", content_type: "audio/webm", size_bytes: 1024, recipe_id: RECIPE_ID });
    expect(r.status).toBe(200);
  });

  it("TC-U-03: chat_image + recipe_id → 200", async () => {
    mockDb();
    const r = await signUpload(UID, { purpose: "chat_image", content_type: "image/jpeg", size_bytes: 1024, recipe_id: RECIPE_ID });
    expect(r.status).toBe(200);
  });

  it("TC-U-04: avatar → 200", async () => {
    mockDb();
    const r = await signUpload(UID, { purpose: "avatar", content_type: "image/png", size_bytes: 1024 });
    expect(r.status).toBe(200);
  });
});
