import { getMapRegions } from "@/lib/map/recipes";

export async function GET() {
  try {
    return Response.json({ regions: await getMapRegions() });
  } catch {
    return Response.json({
      code: "INTERNAL_ERROR",
      message: "지도 지역 목록을 불러오지 못했습니다.",
      details: {},
    }, { status: 500 });
  }
}
