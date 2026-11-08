import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/map/regions", () => ({
  mapRegions: [{ region_code: "47170", region: "안동시", sido: "경북" }],
}));

import { POST } from "@/app/api/profiles/setup/route";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

describe("POST /api/profiles/setup", () => {
  it("Authorization 헤더 없음 → 401", async () => {
    const req = new Request("http://localhost/api/profiles/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "한솔", region_code: "47170" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("유효하지 않은 토큰 → 401", async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { status: 401, message: "invalid" } }),
      },
    } as never);
    const req = new Request("http://localhost/api/profiles/setup", {
      method: "POST",
      headers: { Authorization: "Bearer bad-token", "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "한솔", region_code: "47170" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("body 없음 → 422", async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const req = new Request("http://localhost/api/profiles/setup", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("MISSING_FIELD");
  });

  it("정상 요청 → 200", async () => {
    vi.mocked(createSupabaseServerClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "u1" }, error: null }),
          }),
        }),
      }),
    } as never);
    const req = new Request("http://localhost/api/profiles/setup", {
      method: "POST",
      headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "한솔", region_code: "47170" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.start_route).toBe("/");
  });
});
