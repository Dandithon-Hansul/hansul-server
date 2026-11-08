import "server-only";

import { z } from "zod";
import { mapRegions } from "@/lib/map/regions";
import { recipeMediaUrl } from "@/lib/recipes/media";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const profilePatchSchema = z.strictObject({
  display_name: z.string().trim().min(1).max(50).optional(),
  region_code: z.string().regex(/^\d{5}$/).optional(),
  dong: z.string().trim().min(1).max(50).nullable().optional(),
  food_preferences: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  avatar_url: z.url({ protocol: /^https$/ }).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);

const cursorSchema = z.object({
  id: z.uuid(),
  at: z.iso.datetime({ offset: true }),
});
const pageSchema = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(50));

export function parseProfilePage(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = pageSchema.safeParse(params.get("limit") ?? "20");
  const raw = params.get("cursor");
  if (!limit.success) return null;
  if (!raw) return { limit: limit.data, cursor: null };
  if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const cursor = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return cursor.success ? { limit: limit.data, cursor: cursor.data } : null;
  } catch {
    return null;
  }
}

type Page = NonNullable<ReturnType<typeof parseProfilePage>>;
type Database = ReturnType<typeof createSupabaseAdminClient>;

export function profileError(status: number, code: string, message: string) {
  return profileJson({ code, message, details: {} }, status);
}

export function profileJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function withProfile(
  request: Request,
  run: (db: Database, id: string) => Promise<Response>,
) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return profileError(401, "UNAUTHORIZED", "로그인이 필요합니다.");

  try {
    const { data, error } = await createSupabaseServerClient().auth.getUser(token);
    if (error && error.status !== 400 && error.status !== 401 && error.status !== 403) throw error;
    if (error || !data.user) return profileError(401, "UNAUTHORIZED", "유효한 로그인이 필요합니다.");
    return await run(createSupabaseAdminClient(), data.user.id);
  } catch {
    return profileError(500, "INTERNAL_ERROR", "프로필 요청을 처리하지 못했습니다.");
  }
}

function cursorAfter(column: "created_at" | "saved_at", cursor: NonNullable<Page["cursor"]>) {
  return `${column}.lt.${cursor.at},and(${column}.eq.${cursor.at},id.lt.${cursor.id})`;
}

function nextCursor(rows: { id: string; at: string }[], limit: number) {
  return rows.length > limit ? Buffer.from(JSON.stringify(rows[limit - 1])).toString("base64url") : null;
}

const fields = "id,display_name,avatar_url,region,region_code,dong";

export function regionDto(code: string | null, name: string | null, dong: string | null) {
  if (!code && !name) return null;
  const known = mapRegions.find((region) => region.region_code === code);
  const sido = known?.sido === "대구" ? "대구광역시" : known?.sido === "경북" ? "경상북도" : null;
  return { code, sido, sigungu: known?.region ?? name, dong };
}

export async function readProfile(db: Database, id: string) {
  const { data: profile, error } = await db.from("profiles").select(fields).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!profile) return profileError(404, "PROFILE_NOT_FOUND", "온보딩을 먼저 완료해 주세요.");

  const [recipes, saved] = await Promise.all([
    db.from("recipes").select("id,like_count").eq("transmitter_id", id).eq("status", "published")
      .order("id").limit(250),
    db.from("recipe_saves").select("id,recipes!inner(id)", { count: "exact", head: true })
      .eq("profile_id", id).eq("recipes.status", "published").eq("recipes.visibility", "public"),
  ]);
  if (recipes.error) throw recipes.error;
  if (saved.error) throw saved.error;

  let page = recipes.data;
  let transmitted = 0;
  let likes = 0;
  while (page.length) {
    transmitted += page.length;
    likes += page.reduce((total, recipe) => total + recipe.like_count, 0);
    const result = await db.from("recipes").select("id,like_count").eq("transmitter_id", id)
      .eq("status", "published").gt("id", page[page.length - 1].id).order("id").limit(250);
    if (result.error) throw result.error;
    page = result.data;
  }

  const { region, region_code, dong, ...rest } = profile;
  return profileJson({
    ...rest,
    region: regionDto(region_code, region, dong ?? null),
    stats: { transmitted_recipes: transmitted, saved_recipes: saved.count ?? 0, likes_received: likes },
  });
}

export async function updateProfile(db: Database, id: string, patch: z.infer<typeof profilePatchSchema>) {
  const region = patch.region_code && mapRegions.find((item) => item.region_code === patch.region_code);
  if (patch.region_code && !region) return profileError(422, "INVALID_REGION_CODE", "지원하지 않는 지역 코드입니다.");

  const { data, error } = await db.from("profiles").update({
    ...patch,
    ...(region ? { region: region.region } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id,display_name").maybeSingle();
  if (error) throw error;
  return data ? profileJson({ profile: data }) : profileError(404, "PROFILE_NOT_FOUND", "온보딩을 먼저 완료해 주세요.");
}

export async function readOwnRecipes(db: Database, id: string, { cursor, limit }: Page) {
  const query = db.from("recipes").select("id,title,hero_image_url,like_count,save_count,created_at")
    .eq("transmitter_id", id).eq("status", "published")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  const { data, error } = await (cursor ? query.or(cursorAfter("created_at", cursor)) : query);
  if (error) throw error;
  const recipes = await Promise.all(data.slice(0, limit).map(async ({ id: recipeId, ...recipe }) => ({
    ...recipe,
    recipe_id: recipeId,
    hero_image_url: await recipeMediaUrl(db, recipe.hero_image_url, "recipe-images", id + "/" + recipeId),
  })));
  return profileJson({ recipes, next_cursor: nextCursor(data.map((row) => ({ id: row.id, at: row.created_at })), limit) });
}

type SavedRecipe = {
  id: string;
  title: string;
  hero_image_url: string | null;
  transmitter_id: string;
  profiles: { display_name: string };
};

export async function readSavedRecipes(db: Database, id: string, { cursor, limit }: Page) {
  const query = db.from("recipe_saves")
    .select("id,saved_at,recipes!inner(id,title,hero_image_url,transmitter_id,profiles!recipes_transmitter_id_fkey(display_name))")
    .eq("profile_id", id).eq("recipes.status", "published").eq("recipes.visibility", "public")
    .order("saved_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  const { data, error } = await (cursor ? query.or(cursorAfter("saved_at", cursor)) : query);
  if (error) throw error;
  const recipes = await Promise.all(data.slice(0, limit).map(async (row) => {
    const recipe = row.recipes as unknown as SavedRecipe;
    return {
      recipe_id: recipe.id,
      title: recipe.title,
      hero_image_url: await recipeMediaUrl(db, recipe.hero_image_url, "recipe-images", recipe.transmitter_id + "/" + recipe.id),
      transmitter_name: recipe.profiles.display_name,
      saved_at: row.saved_at,
    };
  }));
  return profileJson({ recipes, next_cursor: nextCursor(data.map((row) => ({ id: row.id, at: row.saved_at })), limit) });
}
