import { recipeMediaUrl } from "@/lib/recipes/media";
import { getRecipeViewer, recipeError, recipeIdSchema, recipeJson } from "@/lib/recipes/http";
import { isRecipeSeedMode, seedRecipe } from "@/lib/recipes/detail";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = recipeIdSchema.safeParse((await params).id);
  if (!id.success) return recipeError(400, "INVALID_PROFILE_ID", "프로필 ID 형식이 올바르지 않습니다.");

  try {
    if (isRecipeSeedMode() && !request.headers.has("authorization")) {
      if (id.data !== seedRecipe.transmitter_id) {
        return recipeError(404, "PROFILE_NOT_FOUND", "전승자를 찾을 수 없습니다.");
      }

      return recipeJson({
        profile_id: id.data,
        display_name: seedRecipe.transmitter_name,
        avatar_url: null,
        region: seedRecipe.region,
        bio: null,
        recipe_count: 1,
        received_like_count: seedRecipe.like_count,
        recipes: [{
          recipe_id: seedRecipe.recipe_id,
          title: seedRecipe.title,
          hero_image_url: seedRecipe.hero_image_url,
        }],
      });
    }

    if (!await getRecipeViewer(request)) {
      return recipeError(401, "UNAUTHORIZED", "유효한 로그인이 필요합니다.");
    }

    const db = createSupabaseAdminClient();
    const { data, error } = await db.rpc("get_public_transmitter", { p_profile_id: id.data });
    if (error) throw error;
    if (!data) return recipeError(404, "PROFILE_NOT_FOUND", "전승자를 찾을 수 없습니다.");
    const recipes = await Promise.all(
      (data.recipes as { recipe_id: string; title: string; hero_image_url: string | null }[])
        .map(async (recipe) => ({
          ...recipe,
          hero_image_url: await recipeMediaUrl(
            db, recipe.hero_image_url, "recipe-images", id.data + "/" + recipe.recipe_id,
          ),
        })),
    );
    return recipeJson({ ...data, recipes });
  } catch {
    return recipeError(500, "INTERNAL_ERROR", "전승자 정보를 불러오지 못했습니다.");
  }
}
