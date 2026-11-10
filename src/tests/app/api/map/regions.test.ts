import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMapRegions: vi.fn(),
  getRegionRecipes: vi.fn(),
}));

vi.mock("@/lib/map/recipes", () => ({
  getMapRegions: mocks.getMapRegions,
  getRegionRecipes: mocks.getRegionRecipes,
}));

import { GET as regionsGet } from "@/app/api/map/regions/route";
import { GET as regionRecipesGet } from "@/app/api/map/regions/[region_code]/recipes/route";

const regionList = [{ region_code: "27110", region: "대구 중구", recipe_count: 3 }];
const recipeList = [{ recipe_id: "r1", title: "안동찜닭" }];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getMapRegions.mockResolvedValue(regionList);
  mocks.getRegionRecipes.mockResolvedValue(recipeList);
});

// ── GET /api/map/regions ─────────────────────────────────────────
describe("GET /api/map/regions", () => {
  it("TC-M-01: 지역 목록 → 200, regions 배열", async () => {
    const r = await regionsGet();
    expect(r.status).toBe(200);
    expect((await r.json()).regions).toEqual(regionList);
  });

  it("내부 오류 → 500", async () => {
    mocks.getMapRegions.mockRejectedValue(new Error("DB error"));
    const r = await regionsGet();
    expect(r.status).toBe(500);
  });
});

// ── GET /api/map/regions/:region_code/recipes ────────────────────
describe("GET /api/map/regions/:region_code/recipes", () => {
  function req(code: string, params = "") {
    return regionRecipesGet(
      new Request(`http://localhost/api/map/regions/${code}/recipes${params}`),
      { params: Promise.resolve({ region_code: code }) },
    );
  }

  it("TC-M-06: region_code 4자리 → 400", async () => {
    const r = await req("1101");
    expect(r.status).toBe(400);
  });

  it("TC-M-07: 존재하지 않는 region_code → 404", async () => {
    // 99999는 mapRegions에 없음
    const r = await req("99999");
    expect(r.status).toBe(404);
  });

  it("TC-M-05: limit=51 → 400 (최댓값 50 초과)", async () => {
    const r = await req("27110", "?limit=51");
    expect(r.status).toBe(400);
  });

  it("TC-M-02: 기본 조회 → 200, region + recipes", async () => {
    const r = await req("27110");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.recipes).toEqual(recipeList);
    expect(body.region).toBeDefined();
  });

  it("TC-M-03: limit=1 (최솟값) → 200, getRegionRecipes에 1 전달", async () => {
    const r = await req("27110", "?limit=1");
    expect(r.status).toBe(200);
    expect(mocks.getRegionRecipes).toHaveBeenCalledWith("27110", 1);
  });

  it("TC-M-04: limit=50 (최댓값) → 200", async () => {
    const r = await req("27110", "?limit=50");
    expect(r.status).toBe(200);
    expect(mocks.getRegionRecipes).toHaveBeenCalledWith("27110", 50);
  });

  it("내부 오류 → 500", async () => {
    mocks.getRegionRecipes.mockRejectedValue(new Error("DB error"));
    const r = await req("27110");
    expect(r.status).toBe(500);
  });
});
