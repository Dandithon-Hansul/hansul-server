import { describe, expect, it, vi } from "vitest";
import { getMapRegions } from "@/lib/map/recipes";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase/server";

describe("getMapRegions with RPC aggregation", () => {
  it("get_map_region_counts RPC를 호출하여 지역별 레시피 수를 O(1) 단일 쿼리로 집계한다", async () => {
    const mockCounts = [
      { region_code: "27000", recipe_count: 12 },
      { region_code: "47170", recipe_count: 7 },
    ];

    const rpcMock = vi.fn().mockResolvedValue({ data: mockCounts, error: null });

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: rpcMock,
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const regions = await getMapRegions();

    expect(rpcMock).toHaveBeenCalledWith("get_map_region_counts");
    const daegu = regions.find((r) => r.region_code === "27000");
    const andong = regions.find((r) => r.region_code === "47170");
    const pohang = regions.find((r) => r.region_code === "47110");

    expect(daegu?.recipe_count).toBe(12);
    expect(andong?.recipe_count).toBe(7);
    expect(pohang?.recipe_count).toBe(0);
  });
});
