import { z } from "zod";

import { getRegionRecipes } from "@/lib/map/recipes";
import { mapRegions } from "@/lib/map/regions";

const limitSchema = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(50));

function fail(status: number, code: string, message: string) {
  return Response.json({ code, message, details: {} }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ region_code: string }> }) {
  const { region_code } = await params;
  if (!/^\d{5}$/.test(region_code)) return fail(400, "INVALID_REGION_CODE", "지역 코드는 숫자 5자리여야 합니다.");

  const region = mapRegions.find((item) => item.region_code === region_code);
  if (!region) return fail(404, "REGION_NOT_FOUND", "지원하는 지역을 찾을 수 없습니다.");

  const limit = limitSchema.safeParse(new URL(request.url).searchParams.get("limit") ?? "10");
  if (!limit.success) return fail(400, "INVALID_LIMIT", "limit은 1 이상 50 이하의 정수여야 합니다.");

  try {
    return Response.json({ region: region.region, recipes: await getRegionRecipes(region_code, limit.data) });
  } catch {
    return fail(500, "INTERNAL_ERROR", "지역 레시피를 불러오지 못했습니다.");
  }
}
