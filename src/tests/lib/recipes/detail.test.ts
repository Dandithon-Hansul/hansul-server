import { describe, expect, it, vi } from "vitest";
import { getRecipeDetail } from "@/lib/recipes/detail";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/recipes/media", () => ({
  recipeMediaUrl: vi.fn().mockImplementation((_db, val) => Promise.resolve(val ? `https://signed.test/${val}` : null)),
}));

import { createSupabaseAdminClient } from "@/lib/supabase/server";

describe("getRecipeDetail with Embed query", () => {
  it("Embed 조인을 통해 레시피, 전승자, 카드 정보를 단일 쿼리로 조회한다", async () => {
    const mockRow = {
      id: "r123",
      title: "안동찜닭",
      hero_image_url: "hero.jpg",
      transmitter_id: "t123",
      region: "안동시",
      region_code: "47170",
      transmitter_quote: "맛있게 조리하세요.",
      cooking_time: 45,
      difficulty: "보통",
      servings: 3,
      like_count: 10,
      save_count: 5,
      ingredients: [{ name: "닭", amount: 1, unit: "마리" }],
      steps: [{ order: 1, title: "손질", description: "씻기", image_url: "step1.jpg" }],
      version: 1,
      updated_at: "2026-11-10T00:00:00Z",
      status: "published",
      visibility: "public",
      transmitter: { display_name: "안동할머니" },
      card: { context_summary: "가족 모임용", voice_message_url: "voice.mp3" },
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
      }),
    });

    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "recipes") return { select: mockSelect };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }),
    };

    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const result = await getRecipeDetail("r123", "viewer-123");

    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("transmitter:profiles!transmitter_id(display_name)"));
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("card:transmission_cards(context_summary, voice_message_url)"));
    expect(mockDb.from.mock.calls.map(([table]) => table)).toEqual(["recipes", "recipe_likes", "recipe_saves"]);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.recipe.title).toBe("안동찜닭");
      expect(result.recipe.transmitter_name).toBe("안동할머니");
      expect(result.recipe.context_summary).toBe("가족 모임용");
      expect(result.recipe.is_liked).toBe(false);
      expect(result.recipe.is_saved).toBe(false);
    }
  });
});
