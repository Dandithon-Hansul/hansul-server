import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveUserId } from "@/lib/auth";
import { buildHomeResponse } from "@/lib/home-response";
import { fetchRecipeList, fetchViewer, fetchInteractions } from "@/lib/repositories/recipes";
import { parseLimit } from "@/lib/query";

const TOP_LIMIT = 6;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 10);

    const client = createSupabaseServiceClient();
    const userId = await resolveUserId(client, request);

    const response = await buildHomeResponse(
      {
        fetchPopular: ({ regionCode, limit }) =>
          fetchRecipeList(client, { regionCode, limit, sort: "popular" }),
        fetchViewer: (id) => fetchViewer(client, id),
        fetchInteractions: (id, ids) => fetchInteractions(client, id, ids),
      },
      { userId, limit, topLimit: TOP_LIMIT },
    );

    return Response.json(response);
  } catch {
    return Response.json({ error: "홈 피드를 불러오지 못했습니다." }, { status: 500 });
  }
}
