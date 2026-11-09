import { describe, expect, it, vi } from "vitest";
import type { createSupabaseAdminClient } from "@/lib/supabase/server";
import { readProfile } from "@/lib/profiles/me";

describe("readProfile with RPC aggregation", () => {
  it("RPC get_profile_stats를 호출하여 단일 쿼리로 프로필 통계를 가져온다", async () => {
    const mockProfile = {
      id: "u123",
      display_name: "김한솔",
      avatar_url: null,
      region: "안동시",
      region_code: "47170",
      dong: "정하동",
      bio: "전통 요리 연구가",
    };

    const mockStats = {
      transmitted_recipes: 5,
      likes_received: 42,
      saved_recipes: 10,
    };

    const rpcMock = vi.fn().mockImplementation(async (fnName: string) => {
      if (fnName === "get_profile_stats") {
        return { data: mockStats, error: null };
      }
      return { data: null, error: new Error("Unknown RPC") };
    });

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      }),
      rpc: rpcMock,
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;

    const response = await readProfile(mockDb, "u123");
    const json = await response.json();

    expect(rpcMock).toHaveBeenCalledWith("get_profile_stats", { p_profile_id: "u123" });
    expect(json.stats).toEqual({
      transmitted_recipes: 5,
      saved_recipes: 10,
      likes_received: 42,
    });
    expect(json.display_name).toBe("김한솔");
  });
});
