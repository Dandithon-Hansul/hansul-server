import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server");

import { getFoodPreferences, getPublishedRecipes } from "@/lib/repositories/recommendations";

describe("recommendations repository", () => {
  it("사용자 프로필에서 음식 취향을 읽는다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { food_preferences: ["구이", 1] }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const db = { from: vi.fn().mockReturnValue({ select }) };

    await expect(getFoodPreferences(db as never, "user-1")).resolves.toEqual(["구이"]);
    expect(db.from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("food_preferences");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("공개·게시된 레시피만 인기순 조회한다", async () => {
    const recipes = [{ id: "recipe-1" }];
    const limit = vi.fn().mockResolvedValue({ data: recipes, error: null });
    const order = vi.fn().mockReturnThis();
    const not = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({ eq, not, order, limit });
    const db = { from: vi.fn().mockReturnValue({ select }) };

    await expect(getPublishedRecipes(db as never)).resolves.toEqual(recipes);
    expect(db.from).toHaveBeenCalledWith("recipes");
    expect(select).toHaveBeenCalledWith(
      "id, transmitter_id, title, hero_image_url, region, transmitter_quote, like_count, created_at",
    );
    expect(eq).toHaveBeenNthCalledWith(1, "status", "published");
    expect(eq).toHaveBeenNthCalledWith(2, "visibility", "public");
    expect(order).toHaveBeenNthCalledWith(1, "like_count", { ascending: false });
    expect(limit).toHaveBeenCalledWith(1000);
  });
});
