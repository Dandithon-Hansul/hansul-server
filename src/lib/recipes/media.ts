import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function recipeMediaUrl(
  db: ReturnType<typeof createSupabaseAdminClient>,
  value: string | null | undefined,
  bucket: string,
  ownerPath: string,
) {
  if (!value) return null;
  if (value.startsWith("https://")) return value;

  const prefix = bucket + "/";
  const path = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  if (!path.startsWith(ownerPath + "/") || path.split("/").includes("..")) return null;

  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function resolveRecipeHeroImages<T extends { id: string; transmitter_id: string; hero_image_url: string | null }>(
  db: ReturnType<typeof createSupabaseAdminClient>,
  rows: T[],
): Promise<T[]> {
  return Promise.all(rows.map(async (row) => ({
    ...row,
    hero_image_url: await recipeMediaUrl(db, row.hero_image_url, "recipe-images", `${row.transmitter_id}/${row.id}`),
  })));
}
