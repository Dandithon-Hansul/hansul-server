import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Database = ReturnType<typeof createSupabaseAdminClient>;

export type RecommendationRow = {
  id: string;
  transmitter_id: string;
  title: string;
  hero_image_url: string | null;
  region: string | null;
  transmitter_quote: string | null;
  like_count: number;
  created_at: string;
};

export async function getFoodPreferences(db: Database, userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("profiles")
    .select("food_preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return Array.isArray(data?.food_preferences)
    ? data.food_preferences.filter((value: unknown): value is string => typeof value === "string")
    : [];
}

export async function getPublishedRecipes(db: Database): Promise<RecommendationRow[]> {
  const { data, error } = await db
    .from("recipes")
    .select("id, transmitter_id, title, hero_image_url, region, transmitter_quote, like_count, created_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .not("title", "is", null)
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return (data ?? []) as RecommendationRow[];
}
