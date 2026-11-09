import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRecipeViewer, recipeJson, recipeError } from "@/lib/recipes/http";
import { buildHomeResponse } from "@/lib/home-response";
import { fetchRecipeList, fetchViewer, fetchInteractions, fetchMonthlyTop } from "@/lib/repositories/recipes";
import { parseLimit } from "@/lib/query";
import { recipeMediaUrl } from "@/lib/recipes/media";

const TOP_LIMIT = 6;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 10);

    const client = createSupabaseAdminClient();
    const userId = await getRecipeViewer(request);

    const response = await buildHomeResponse(
      {
        fetchMonthlyTop: ({ limit }) => fetchMonthlyTop(client, { limit }),
        fetchPopular: ({ regionCode, limit }) =>
          fetchRecipeList(client, { regionCode, limit, sort: "popular" }),
        fetchViewer: (id) => fetchViewer(client, id),
        fetchInteractions: (id, ids) => fetchInteractions(client, id, ids),
        resolveHeroImageUrl: (url, tid, rid) =>
          recipeMediaUrl(client, url, "recipe-images", `${tid}/${rid}`),
      },
      { userId, limit, topLimit: TOP_LIMIT },
    );

    return recipeJson(response);
  } catch {
    return recipeError(500, "home_unavailable", "홈 피드를 불러오지 못했습니다.");
  }
}
