import "server-only";

import { getRecipeViewer, recipeError, recipeJson } from "@/lib/recipes/http";
import { getRecommendedRecipes, recommendationLimitSchema } from "@/lib/services/recommendations";

export async function GET(request: Request) {
  try {
    const userId = await getRecipeViewer(request);
    if (!userId) return recipeError(401, "UNAUTHORIZED", "로그인이 필요합니다.");

    const parsedLimit = recommendationLimitSchema.safeParse(
      new URL(request.url).searchParams.get("limit") ?? undefined,
    );
    if (!parsedLimit.success) {
      return recipeError(422, "INVALID_LIMIT", "추천 음식은 한 번에 1개만 조회할 수 있습니다.");
    }

    const recipes = await getRecommendedRecipes(userId, parsedLimit.data);
    return recipeJson({ recipes });
  } catch {
    return recipeError(500, "INTERNAL_ERROR", "추천 음식을 불러오지 못했습니다.");
  }
}
