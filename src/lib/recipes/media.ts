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
