import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recipeJson, recipeError } from "@/lib/recipes/http";
import { fetchRecipeList } from "@/lib/repositories/recipes";
import { toPopularCard } from "@/lib/dto/recipe";
import { parseLimit } from "@/lib/query";
import { interviewDependencies } from "@/lib/interview/dependencies";
import { createInterviewHandlers, interviewFailure } from "@/lib/interview/http";
import { resolveRecipeHeroImages } from "@/lib/recipes/media";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "recent";
    const regionCode = searchParams.get("region_code");
    const limit = parseLimit(searchParams.get("limit"), 20);

    const client = createSupabaseAdminClient();
    const rows = await fetchRecipeList(client, { regionCode, limit, sort });

    const resolved = await resolveRecipeHeroImages(client, rows);
    return recipeJson({ recipes: resolved.map(toPopularCard), next_cursor: null });
  } catch {
    return recipeError(500, "recipe_list_unavailable", "레시피 목록을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try { return await createInterviewHandlers(await interviewDependencies(request)).publish(request); }
  catch (error) { return interviewFailure(error); }
}
