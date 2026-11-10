import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRecipeList: vi.fn(),
  fetchMonthlyTop: vi.fn(),
  fetchViewer: vi.fn(),
  fetchInteractions: vi.fn(),
  buildHomeResponse: vi.fn(),
  searchRecipes: vi.fn(),
  resolveHeroImages: vi.fn(),
  getRecipeViewer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/recipes/http", () => ({
  getRecipeViewer: mocks.getRecipeViewer,
  recipeJson: (body: unknown, status = 200) => Response.json(body, { status }),
  recipeError: (status: number, code: string, message: string) =>
    Response.json({ code, message, details: {} }, { status }),
}));
vi.mock("@/lib/repositories/recipes", () => ({
  fetchRecipeList: mocks.fetchRecipeList,
  fetchMonthlyTop: mocks.fetchMonthlyTop,
  fetchViewer: mocks.fetchViewer,
  fetchInteractions: mocks.fetchInteractions,
  searchRecipes: mocks.searchRecipes,
}));
vi.mock("@/lib/home-response", () => ({ buildHomeResponse: mocks.buildHomeResponse }));
vi.mock("@/lib/recipes/media", () => ({ resolveRecipeHeroImages: mocks.resolveHeroImages, recipeMediaUrl: vi.fn() }));
vi.mock("@/lib/dto/recipe", () => ({ toPopularCard: (r: unknown) => r, toSearchCard: (r: unknown) => r }));

import { GET as homeGet } from "@/app/api/home/route";
import { GET as recipesGet } from "@/app/api/recipes/route";
import { GET as searchGet } from "@/app/api/search/recipes/route";

const recipe = { id: "r1", title: "안동찜닭", hero_image_url: null, transmitter_id: "u1", like_count: 1, save_count: 0 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getRecipeViewer.mockResolvedValue(null);
  mocks.fetchRecipeList.mockResolvedValue([recipe]);
  mocks.searchRecipes.mockResolvedValue([recipe]);
  mocks.resolveHeroImages.mockResolvedValue([recipe]);
  mocks.buildHomeResponse.mockResolvedValue({ monthly_top: [], popular: [], interactions: {} });
});

// ── GET /api/home ────────────────────────────────────────────────
describe("GET /api/home", () => {
  it("TC-R-01: 기본 → 200", async () => {
    const r = await homeGet(new Request("http://localhost/api/home"));
    expect(r.status).toBe(200);
  });

  it("TC-R-02: limit=5 → 200", async () => {
    const r = await homeGet(new Request("http://localhost/api/home?limit=5"));
    expect(r.status).toBe(200);
  });

  it("내부 오류 → 500", async () => {
    mocks.buildHomeResponse.mockRejectedValue(new Error("DB error"));
    const r = await homeGet(new Request("http://localhost/api/home"));
    expect(r.status).toBe(500);
  });
});

// ── GET /api/recipes ─────────────────────────────────────────────
describe("GET /api/recipes", () => {
  it("TC-R-03: 기본 조회 → 200, recipes 배열 포함", async () => {
    const r = await recipesGet(new Request("http://localhost/api/recipes"));
    expect(r.status).toBe(200);
    expect((await r.json()).recipes).toBeDefined();
  });

  it("TC-R-04: region_code 필터 → fetchRecipeList에 전달", async () => {
    await recipesGet(new Request("http://localhost/api/recipes?region_code=11010"));
    expect(mocks.fetchRecipeList).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ regionCode: "11010" }),
    );
  });

  it("TC-R-05: sort=recent → fetchRecipeList에 sort 전달", async () => {
    await recipesGet(new Request("http://localhost/api/recipes?sort=recent"));
    expect(mocks.fetchRecipeList).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sort: "recent" }),
    );
  });

  it("내부 오류 → 500", async () => {
    mocks.fetchRecipeList.mockRejectedValue(new Error("DB error"));
    const r = await recipesGet(new Request("http://localhost/api/recipes"));
    expect(r.status).toBe(500);
  });
});

// ── GET /api/search/recipes ──────────────────────────────────────
describe("GET /api/search/recipes", () => {
  it("TC-R-11: 키워드 검색 → 200", async () => {
    const r = await searchGet(new Request("http://localhost/api/search/recipes?q=된장찌개"));
    expect(r.status).toBe(200);
    expect(mocks.searchRecipes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: "된장찌개" }),
    );
  });

  it("TC-R-12: 키워드+지역 필터 → 200", async () => {
    const r = await searchGet(new Request("http://localhost/api/search/recipes?q=된장&region_code=11010"));
    expect(r.status).toBe(200);
    expect(mocks.searchRecipes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: "된장", regionCode: "11010" }),
    );
  });

  it("TC-R-13: q 없음 → 200 (빈 쿼리로 처리)", async () => {
    const r = await searchGet(new Request("http://localhost/api/search/recipes"));
    expect(r.status).toBe(200);
    expect(mocks.searchRecipes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: "" }),
    );
  });

  it("내부 오류 → 500", async () => {
    mocks.searchRecipes.mockRejectedValue(new Error("DB error"));
    const r = await searchGet(new Request("http://localhost/api/search/recipes"));
    expect(r.status).toBe(500);
  });
});
