import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recipeJson, recipeError } from "@/lib/recipes/http";
import { searchRecipes } from "@/lib/repositories/recipes";
import { toSearchCard } from "@/lib/dto/recipe";
import { parseLimit } from "@/lib/query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const regionCode = searchParams.get("region_code");
    const limit = parseLimit(searchParams.get("limit"), 20);

    const client = createSupabaseAdminClient();
    const rows = await searchRecipes(client, { q, regionCode, limit });

    return recipeJson({ recipes: rows.map(toSearchCard), next_cursor: null });
  } catch {
    return recipeError(500, "search_unavailable", "검색에 실패했습니다.");
  }
}
