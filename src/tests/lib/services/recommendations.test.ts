import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server");

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRecommendedRecipes, recommendationLimitSchema } from "@/lib/services/recommendations";

describe("recommendationLimitSchema", () => {
  it("기본 limit은 1이다", () => {
    expect(recommendationLimitSchema.parse(undefined)).toBe(1);
  });

  it("limit은 1만 허용한다", () => {
    expect(recommendationLimitSchema.safeParse("1").success).toBe(true);
    expect(recommendationLimitSchema.safeParse("0").success).toBe(false);
    expect(recommendationLimitSchema.safeParse("1.5").success).toBe(false);
    expect(recommendationLimitSchema.safeParse("2").success).toBe(false);
  });
});

describe("getRecommendedRecipes", () => {
  const db = { from: vi.fn() };

  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);
    db.from.mockReset();
  });

  it("취향 카테고리와 일치하는 공개 레시피를 먼저 반환한다", async () => {
    db.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { food_preferences: ["탕·찌개"] }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              not: () => ({
                order: () => ({
                  order: () => ({
                    then: undefined,
                    limit: async () => ({
                      data: [
                        { id: "popular", title: "안동 찜닭", hero_image_url: null, region: "안동시", transmitter_quote: "오래 끓여요", like_count: 90, created_at: "2026-01-01" },
                        { id: "match", title: "대구식 육개장", hero_image_url: null, region: "대구 중구", transmitter_quote: "파를 듬뿍 넣어요", like_count: 3, created_at: "2026-01-02" },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    });

    const result = await getRecommendedRecipes("user-1", 1);

    expect(result).toEqual([
      {
        recipe_id: "match",
        title: "대구식 육개장",
        hero_image_url: null,
        region_tag: "대구 중구",
        transmitter_quote: "파를 듬뿍 넣어요",
      },
    ]);
  });

  it("선호 카테고리 매칭이 없으면 인기순으로 반환한다", async () => {
    db.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { food_preferences: [] }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              not: () => ({
                order: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: [
                        { id: "one", title: "된장찌개", hero_image_url: "https://example.com/one", region: "대구", transmitter_quote: null, like_count: 11, created_at: "2026-01-01" },
                        { id: "two", title: "나물무침", hero_image_url: null, region: null, transmitter_quote: "간을 봐요", like_count: 2, created_at: "2026-01-02" },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    });

    const result = await getRecommendedRecipes("user-1", 10);

    expect(result.map((recipe) => recipe.recipe_id)).toEqual(["one", "two"]);
    expect(result[0].transmitter_quote).toBe("");
    expect(result[1].region_tag).toBe("");
  });
});
