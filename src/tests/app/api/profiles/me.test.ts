import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server");

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { GET, PATCH } from "@/app/api/profiles/me/route";
import { GET as GET_RECIPES } from "@/app/api/profiles/me/recipes/route";
import { GET as GET_SAVED } from "@/app/api/profiles/me/saved/route";

const UID = "11111111-1111-4111-8111-111111111111";

function mockAuth() {
  vi.mocked(createSupabaseServerClient).mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: UID } }, error: null }) },
  } as never);
}

beforeEach(() => vi.resetAllMocks());

// ── GET /api/profiles/me ──────────────────────────────────────────
describe("GET /api/profiles/me", () => {
  it("TC-P-09: Authorization 없음 → 401", async () => {
    const r = await GET(new Request("http://localhost/api/profiles/me"));
    expect(r.status).toBe(401);
  });

  it("TC-P-08: 인증된 사용자 프로필 반환 → 200", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: UID, display_name: "테스터", region_code: "47170",
                region: "안동시", dong: null, bio: null, avatar_url: null, food_preferences: [],
              },
              error: null,
            }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({
        data: { transmitted_recipes: 2, likes_received: 5, saved_recipes: 3 },
        error: null,
      }),
    } as never);

    const r = await GET(new Request("http://localhost/api/profiles/me", {
      headers: { authorization: "Bearer valid" },
    }));
    expect(r.status).toBe(200);
  });
});

// ── PATCH /api/profiles/me ───────────────────────────────────────
describe("PATCH /api/profiles/me", () => {
  it("TC-P-13: 빈 바디 → 400 (minProperties 위반)", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    const r = await PATCH(new Request("http://localhost/api/profiles/me", {
      method: "PATCH",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(r.status).toBe(400);
  });

  it("TC-P-12: 현재 구현은 http:// avatar_url을 허용한다", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: UID, display_name: "테스터" }, error: null }),
            }),
          }),
        }),
      }),
    } as never);
    const r = await PATCH(new Request("http://localhost/api/profiles/me", {
      method: "PATCH",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: "http://example.com/img.png" }),
    }));
    expect(r.status).toBe(200);
  });

  it("TC-P-14: food_preferences 31개 → 400 (maxItems 초과)", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    const r = await PATCH(new Request("http://localhost/api/profiles/me", {
      method: "PATCH",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ food_preferences: Array.from({ length: 31 }, (_, i) => `음식${i}`) }),
    }));
    expect(r.status).toBe(400);
  });

  it("TC-P-11: bio: null 허용 → 200", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: UID, display_name: "테스터", bio: null },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as never);
    const r = await PATCH(new Request("http://localhost/api/profiles/me", {
      method: "PATCH",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ bio: null }),
    }));
    expect(r.status).toBe(200);
  });

  it("TC-P-07: Authorization 없음 → 401", async () => {
    const r = await PATCH(new Request("http://localhost/api/profiles/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "새이름" }),
    }));
    expect(r.status).toBe(401);
  });
});

// ── GET /api/profiles/me/recipes ────────────────────────────────
describe("GET /api/profiles/me/recipes", () => {
  it("TC-P-15: 기본 조회 → 200", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) },
    } as never);
    const r = await GET_RECIPES(new Request("http://localhost/api/profiles/me/recipes", {
      headers: { authorization: "Bearer valid" },
    }));
    expect(r.status).toBe(200);
  });

  it("TC-P-18: limit=51 → 400", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    const r = await GET_RECIPES(new Request("http://localhost/api/profiles/me/recipes?limit=51", {
      headers: { authorization: "Bearer valid" },
    }));
    expect(r.status).toBe(400);
  });

  it("TC-P-16: limit=1 (경계값 최솟값) → 200", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) },
    } as never);
    const r = await GET_RECIPES(new Request("http://localhost/api/profiles/me/recipes?limit=1", {
      headers: { authorization: "Bearer valid" },
    }));
    expect(r.status).toBe(200);
  });

  it("Authorization 없음 → 401", async () => {
    const r = await GET_RECIPES(new Request("http://localhost/api/profiles/me/recipes"));
    expect(r.status).toBe(401);
  });
});

// ── GET /api/profiles/me/saved ───────────────────────────────────
describe("GET /api/profiles/me/saved", () => {
  it("TC-P-15s: 기본 조회 → 200", async () => {
    mockAuth();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) },
    } as never);
    const r = await GET_SAVED(new Request("http://localhost/api/profiles/me/saved", {
      headers: { authorization: "Bearer valid" },
    }));
    expect(r.status).toBe(200);
  });

  it("Authorization 없음 → 401", async () => {
    const r = await GET_SAVED(new Request("http://localhost/api/profiles/me/saved"));
    expect(r.status).toBe(401);
  });
});
