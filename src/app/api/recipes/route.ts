import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fetchRecipeList } from "@/lib/repositories/recipes";
import { toPopularCard } from "@/lib/dto/recipe";
import { parseLimit } from "@/lib/query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "recent";
    const regionCode = searchParams.get("region_code");
    const limit = parseLimit(searchParams.get("limit"), 20);

    const client = createSupabaseServiceClient();
    const rows = await fetchRecipeList(client, { regionCode, limit, sort });

    return Response.json({ recipes: rows.map(toPopularCard), next_cursor: null });
  } catch {
    return Response.json({ error: "레시피 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
