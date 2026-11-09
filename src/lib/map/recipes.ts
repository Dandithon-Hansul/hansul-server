import "server-only";

import { recipeMediaUrl } from "@/lib/recipes/media";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { daeguRegion, mapDisplayRegions } from "./regions";

export async function getMapRegions() {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("get_map_region_counts");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { region_code: string; recipe_count: number | string }[]) {
    counts.set(row.region_code, Number(row.recipe_count));
  }

  return mapDisplayRegions.map((region) => ({
    ...region,
    recipe_count: counts.get(region.region_code) ?? 0,
  }));
}

export async function getRegionRecipes(regionCode: string, limit: number) {
  const db = createSupabaseAdminClient();
  const query = db.from("recipes")
    .select("id,title,hero_image_url,transmitter_id,like_count,save_count,profiles!recipes_transmitter_id_fkey(display_name)")
    .eq("status", "published").eq("visibility", "public")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit);
  const { data, error } = await (regionCode === daeguRegion.region_code
    ? query.like("region_code", "27%")
    : query.eq("region_code", regionCode));
  if (error) throw error;

  return Promise.all(data.map(async (recipe) => ({
    recipe_id: recipe.id,
    title: recipe.title,
    hero_image_url: await recipeMediaUrl(
      db, recipe.hero_image_url, "recipe-images", recipe.transmitter_id + "/" + recipe.id,
    ),
    transmitter_name: (recipe.profiles as unknown as { display_name: string }).display_name,
    like_count: recipe.like_count,
    save_count: recipe.save_count,
  })));
}
