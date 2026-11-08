import "server-only";

import { z } from "zod";
import { mapRegions } from "@/lib/map/regions";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const setupSchema = z.object({
  display_name: z.string().trim().min(1).max(50),
  region_code: z.string().regex(/^\d{5}$/),
  food_preferences: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

type SetupInput = z.infer<typeof setupSchema>;
type Database = ReturnType<typeof createSupabaseAdminClient>;

const headers = { "Cache-Control": "private, no-store" };

export function setupJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}

export function setupError(status: number, code: string, message: string) {
  return setupJson({ code, message, details: {} }, status);
}

export async function withSetup(
  request: Request,
  run: (db: Database, userId: string) => Promise<Response>,
): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return setupError(401, "UNAUTHORIZED", "로그인이 필요합니다.");

  try {
    const { data, error } = await createSupabaseServerClient().auth.getUser(token);
    if (error && error.status !== 400 && error.status !== 401 && error.status !== 403) throw error;
    if (error || !data.user) return setupError(401, "UNAUTHORIZED", "유효한 로그인이 필요합니다.");
    return await run(createSupabaseAdminClient(), data.user.id);
  } catch {
    return setupError(500, "INTERNAL_ERROR", "온보딩 저장에 실패했습니다.");
  }
}

export async function createOnboarding(
  db: Database,
  userId: string,
  data: SetupInput,
): Promise<Response> {
  const region = mapRegions.find((r) => r.region_code === data.region_code);
  if (!region) return setupError(422, "INVALID_REGION_CODE", "지원하지 않는 지역 코드입니다.");

  const { data: profile, error } = await db
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: data.display_name,
        region_code: data.region_code,
        region: region.region,
        food_preferences: data.food_preferences ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return setupJson({ profile_id: profile!.id, start_route: "/" });
}
