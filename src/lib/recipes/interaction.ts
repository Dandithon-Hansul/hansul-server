import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRecipeViewer, recipeError, recipeIdSchema, recipeJson } from "./http";

export async function toggleRecipeInteraction(request: Request, id: string, kind: "like" | "save") {
  const parsed = recipeIdSchema.safeParse(id);
  if (!parsed.success) return recipeError(400, "INVALID_RECIPE_ID", "레시피 ID 형식이 올바르지 않습니다.");

  try {
    const viewer = await getRecipeViewer(request);
    if (!viewer) return recipeError(401, "UNAUTHORIZED", "유효한 로그인이 필요합니다.");

    const { data, error } = await createSupabaseAdminClient().rpc("toggle_recipe_interaction", {
      p_recipe_id: parsed.data,
      p_profile_id: viewer,
      p_kind: kind,
    });
    if (error?.code === "P0002") return recipeError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
    if (error?.code === "42501") return recipeError(403, "FORBIDDEN", "레시피에 접근할 수 없거나 프로필이 없습니다.");
    if (error) throw error;
    return recipeJson(data);
  } catch {
    return recipeError(500, "INTERNAL_ERROR", "레시피 상태를 변경하지 못했습니다.");
  }
}
