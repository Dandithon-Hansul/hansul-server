import "server-only";

import { z } from "zod";
import {
  getFoodPreferences,
  getPublishedRecipes,
  type RecommendationRow,
} from "@/lib/repositories/recommendations";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const recommendationLimitSchema = z.coerce.number().int().min(1).max(1).default(1);

const preferenceCategories: Record<string, string[]> = {
  "탕·찌개": ["탕", "찌개", "국", "전골", "육개장", "국밥", "곰탕"],
  구이: ["구이", "불고기"],
  "찜·조림": ["찜", "조림"],
  볶음: ["볶음"],
  "전·나물·무침": ["전", "나물", "무침"],
};

function matchesPreference(recipe: RecommendationRow, preferences: string[]): boolean {
  const title = recipe.title.replaceAll(" ", "");
  return preferences.some((preference) => {
    const category = Object.entries(preferenceCategories).find(
      ([name, values]) => preference.includes(name) || values.some((value) => preference.includes(value)),
    );
    const keywords = category ? category[1] : [preference.replaceAll(" ", "")];
    return keywords.some((keyword) => title.includes(keyword.replaceAll(" ", "")));
  });
}

export async function getRecommendedRecipes(userId: string, limit: number) {
  const db = createSupabaseAdminClient();
  const [preferences, recipes] = await Promise.all([
    getFoodPreferences(db, userId),
    getPublishedRecipes(db),
  ]);

  return recipes
    .sort((a, b) => {
      const preferenceOrder = Number(matchesPreference(b, preferences)) - Number(matchesPreference(a, preferences));
      return preferenceOrder || b.like_count - a.like_count || b.created_at.localeCompare(a.created_at);
    })
    .slice(0, limit)
    .map((recipe) => ({
      recipe_id: recipe.id,
      title: recipe.title,
      hero_image_url: recipe.hero_image_url,
      region_tag: recipe.region ?? "",
      transmitter_quote: recipe.transmitter_quote ?? "",
    }));
}
