import "server-only";

import { recipeMediaUrl } from "@/lib/recipes/media";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { daeguRegion, mapDisplayRegions } from "./regions";

export async function getMapRegions() {
  const db = createSupabaseAdminClient();
  const counts = new Map<string, number>();
  const codes = mapDisplayRegions.filter(({ sido }) => sido === "경북").map(({ region_code }) => region_code);
  let lastId: string | undefined;

  // Keep each response under the PostgREST row cap.
  for (;;) {
    const query = db.from("recipes").select("id,region_code")
      .eq("status", "published").eq("visibility", "public")
      .or(`region_code.like.27*,region_code.in.(${codes.join(",")})`).order("id").limit(250);
    const { data, error } = await (lastId ? query.gt("id", lastId) : query);
    if (error) throw error;
    if (data.length === 0) break;

    for (const row of data) {
      const code = row.region_code.startsWith("27") ? daeguRegion.region_code : row.region_code;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    lastId = data[data.length - 1].id;
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
