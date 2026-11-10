import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/recipes/http", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/recipes/http")>(),
  getRecipeViewer: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: vi.fn() }));

import { POST as likePost } from "@/app/api/recipes/[id]/like/route";
import { POST as savePost } from "@/app/api/recipes/[id]/save/route";
import { getRecipeViewer } from "@/lib/recipes/http";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const RECIPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARAMS = { params: Promise.resolve({ id: RECIPE_ID }) };

beforeEach(() => vi.resetAllMocks());

function mockRpc(result: unknown) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    rpc: vi.fn().mockResolvedValue({ data: result, error: null }),
  } as never);
}

describe("POST /api/recipes/:id/like", () => {
  it("TC-R-24: 미인증 → 401", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue(null);
    const r = await likePost(new Request("http://localhost", { method: "POST" }), PARAMS);
    expect(r.status).toBe(401);
  });

  it("TC-R-22: 좋아요 → 200, liked 상태 반환", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    mockRpc({ liked: true, like_count: 1 });
    const r = await likePost(
      new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer valid" } }),
      PARAMS,
    );
    expect(r.status).toBe(200);
    expect((await r.json()).liked).toBe(true);
  });

  it("TC-R-23: 좋아요 취소 (토글) → 200, liked=false", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    mockRpc({ liked: false, like_count: 0 });
    const r = await likePost(
      new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer valid" } }),
      PARAMS,
    );
    expect(r.status).toBe(200);
    expect((await r.json()).liked).toBe(false);
  });

  it("UUID 형식 오류 → 400", async () => {
    const r = await likePost(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(r.status).toBe(400);
  });
});

describe("POST /api/recipes/:id/save", () => {
  it("TC-R-25: 미인증 → 401", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue(null);
    const r = await savePost(new Request("http://localhost", { method: "POST" }), PARAMS);
    expect(r.status).toBe(401);
  });

  it("TC-R-25s: 저장 → 200, saved 상태 반환", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    mockRpc({ saved: true, save_count: 1 });
    const r = await savePost(
      new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer valid" } }),
      PARAMS,
    );
    expect(r.status).toBe(200);
    expect((await r.json()).saved).toBe(true);
  });

  it("TC-R-26: 저장 취소 (토글) → 200, saved=false", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    mockRpc({ saved: false, save_count: 0 });
    const r = await savePost(
      new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer valid" } }),
      PARAMS,
    );
    expect(r.status).toBe(200);
    expect((await r.json()).saved).toBe(false);
  });
});
