import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawRecipeRow, InteractionSets } from "@/lib/dto/recipe";
import type { Viewer } from "@/lib/home-response";

const CARD_SELECT =
  "id, title, hero_image_url, transmitter_quote, like_count, save_count, region, region_code, created_at, transmitter:profiles!transmitter_id(display_name)";

interface QueryRow {
  id: string;
  title: string | null;
  hero_image_url: string | null;
  transmitter_quote: string | null;
  like_count: number;
  save_count: number;
  region: string | null;
  region_code: string | null;
  created_at: string;
  transmitter:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
}

function normalizeRow(raw: QueryRow): RawRecipeRow {
  const t = Array.isArray(raw.transmitter) ? (raw.transmitter[0] ?? null) : raw.transmitter;
  return {
    id: raw.id,
    title: raw.title,
    hero_image_url: raw.hero_image_url,
    transmitter_quote: raw.transmitter_quote,
    like_count: raw.like_count,
    save_count: raw.save_count,
    region: raw.region,
    region_code: raw.region_code,
    created_at: raw.created_at,
    transmitter: t ? { display_name: t.display_name ?? null } : null,
  };
}

// PostgREST .or() 필터를 깨뜨리는 문자를 제거한다.
function sanitizeTerm(q: string): string {
  return q.replace(/[,()%]/g, "").trim();
}

export async function fetchRecipeList(
  client: SupabaseClient,
  { regionCode, limit, sort }: { regionCode: string | null; limit: number; sort: string },
): Promise<RawRecipeRow[]> {
  let query = client
    .from("recipes")
    .select(CARD_SELECT)
    .eq("status", "published")
    .eq("visibility", "public");

  if (regionCode) query = query.eq("region_code", regionCode);

  query =
    sort === "popular"
      ? query
          .order("popularity_score", { ascending: false })
          .order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return (data as unknown as QueryRow[]).map(normalizeRow);
}

export async function searchRecipes(
  client: SupabaseClient,
  { q, regionCode, limit }: { q: string; regionCode: string | null; limit: number },
): Promise<RawRecipeRow[]> {
  const term = sanitizeTerm(q);

  let query = client
    .from("recipes")
    .select(CARD_SELECT)
    .eq("status", "published")
    .eq("visibility", "public");

  if (regionCode) query = query.eq("region_code", regionCode);
  if (term) query = query.or(`title.ilike.%${term}%,region.ilike.%${term}%`);

  const { data, error } = await query
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as QueryRow[]).map(normalizeRow);
}

interface MonthlyTopRpcRow {
  id: string;
  title: string | null;
  hero_image_url: string | null;
  transmitter_quote: string | null;
  like_count: number;
  save_count: number;
  region: string | null;
  region_code: string | null;
  created_at: string;
  transmitter_display_name: string | null;
}

function normalizeRpcRow(raw: MonthlyTopRpcRow): RawRecipeRow {
  return {
    id: raw.id,
    title: raw.title,
    hero_image_url: raw.hero_image_url,
    transmitter_quote: raw.transmitter_quote,
    like_count: raw.like_count,
    save_count: raw.save_count,
    region: raw.region,
    region_code: raw.region_code,
    created_at: raw.created_at,
    transmitter: raw.transmitter_display_name
      ? { display_name: raw.transmitter_display_name }
      : null,
  };
}

export async function fetchMonthlyTop(
  client: SupabaseClient,
  { limit }: { limit: number },
): Promise<RawRecipeRow[]> {
  const { data, error } = await client.rpc("get_monthly_top_recipes", { p_limit: limit });
  if (error) throw error;
  return (data as MonthlyTopRpcRow[]).map(normalizeRpcRow);
}

export async function fetchViewer(
  client: SupabaseClient,
  userId: string,
): Promise<Viewer | null> {
  const { data, error } = await client
    .from("profiles")
    .select("display_name, region_code")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { display_name: data.display_name, region_code: data.region_code };
}

export async function fetchInteractions(
  client: SupabaseClient,
  userId: string,
  recipeIds: string[],
): Promise<InteractionSets> {
  if (recipeIds.length === 0) {
    return { likedIds: new Set<string>(), savedIds: new Set<string>() };
  }

  const [likes, saves] = await Promise.all([
    client.from("recipe_likes").select("recipe_id").eq("profile_id", userId).in("recipe_id", recipeIds),
    client.from("recipe_saves").select("recipe_id").eq("profile_id", userId).in("recipe_id", recipeIds),
  ]);
  if (likes.error) throw likes.error;
  if (saves.error) throw saves.error;

  return {
    likedIds: new Set((likes.data as { recipe_id: string }[]).map((r) => r.recipe_id)),
    savedIds: new Set((saves.data as { recipe_id: string }[]).map((r) => r.recipe_id)),
  };
}
