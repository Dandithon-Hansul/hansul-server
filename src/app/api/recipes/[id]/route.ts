import { getRecipeDetail, isRecipeSeedMode } from "@/lib/recipes/detail";
import { getRecipeViewer, recipeError, recipeIdSchema, recipeJson } from "@/lib/recipes/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = recipeIdSchema.safeParse((await params).id);
  if (!parsed.success) return recipeError(400, "INVALID_RECIPE_ID", "레시피 ID 형식이 올바르지 않습니다.");

  try {
    const seedRequest = isRecipeSeedMode() && !request.headers.has("authorization");
    const userId = seedRequest ? null : await getRecipeViewer(request);
    if (!seedRequest && !userId) return recipeError(401, "UNAUTHORIZED", "유효한 로그인이 필요합니다.");

    const result = await getRecipeDetail(parsed.data, userId);
    if (result.status === "missing") return recipeError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다.");
    if (result.status === "forbidden") return recipeError(403, "FORBIDDEN", "레시피에 접근할 수 없습니다.");
    return recipeJson(result.recipe);
  } catch {
    return recipeError(500, "INTERNAL_ERROR", "레시피를 불러오지 못했습니다.");
  }
}
