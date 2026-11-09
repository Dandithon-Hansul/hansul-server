import { describe, it, expect, vi } from "vitest";
import { buildHomeResponse, type HomeDeps } from "./home-response";
import type { RawRecipeRow } from "./dto/recipe";

function row(id: string, regionCode: string | null): RawRecipeRow {
  return {
    id,
    transmitter_id: "owner",
    title: id,
    hero_image_url: null,
    transmitter_quote: null,
    like_count: 0,
    save_count: 0,
    region: regionCode,
    region_code: regionCode,
    created_at: "2026-11-01T00:00:00.000Z",
    transmitter: { display_name: "t" },
  };
}

const pool = [
  row("top1", "27110"),
  row("top2", "27110"),
  row("rec1", "47170"),
  row("rec2", "27110"),
];

function makeDeps(overrides: Partial<HomeDeps> = {}): HomeDeps {
  return {
    fetchMonthlyTop: vi.fn(async ({ limit }) => pool.slice(0, limit)),
    fetchPopular: vi.fn(async ({ limit }) => pool.slice(0, limit)),
    fetchViewer: vi.fn(async () => ({ display_name: "김한솔", region_code: "47170" })),
    fetchInteractions: vi.fn(async () => ({
      likedIds: new Set(["rec1"]),
      savedIds: new Set<string>(),
    })),
    resolveHeroImages: vi.fn(async (rows) => rows),
    ...overrides,
  };
}

describe("buildHomeResponse", () => {
  it("TOP과 추천 이미지를 한 번에 해석한다", async () => {
    const resolveHeroImages = vi.fn(async (rows: RawRecipeRow[]) => rows.map((recipe) => ({
      ...recipe,
      hero_image_url: `https://signed.example/${recipe.id}`,
    })));
    const deps = makeDeps({ resolveHeroImages });

    const res = await buildHomeResponse(deps, { userId: null, limit: 10, topLimit: 2 });

    expect(resolveHeroImages).toHaveBeenCalledOnce();
    expect(res.top_recipes.map((recipe) => recipe.hero_image_url)).toEqual([
      "https://signed.example/top1",
      "https://signed.example/top2",
    ]);
    expect(res.recommended.map((recipe) => recipe.hero_image_url)).toEqual([
      "https://signed.example/rec1",
      "https://signed.example/rec2",
    ]);
  });

  it("프로필·월간 TOP·추천 후보 조회를 동시에 시작한다", async () => {
    let finishMonthlyTop!: (rows: RawRecipeRow[]) => void;
    const monthlyTop = new Promise<RawRecipeRow[]>((resolve) => { finishMonthlyTop = resolve; });
    const deps = makeDeps({
      fetchMonthlyTop: vi.fn(() => monthlyTop),
    });

    const response = buildHomeResponse(deps, { userId: "u1", limit: 10, topLimit: 2 });
    const startedTogether = {
      monthlyTop: vi.mocked(deps.fetchMonthlyTop).mock.calls.length,
      viewer: vi.mocked(deps.fetchViewer).mock.calls.length,
      popular: vi.mocked(deps.fetchPopular).mock.calls.length,
    };
    finishMonthlyTop(pool.slice(0, 2));
    await response;

    expect(startedTogether).toEqual({ monthlyTop: 1, viewer: 1, popular: 1 });
    expect(deps.fetchViewer).toHaveBeenCalledWith("u1");
  });

  it("TOP과 추천 이미지 경로를 응답 URL로 변환한다", async () => {
    const deps = makeDeps({
      fetchMonthlyTop: vi.fn(async () => [{ ...row("top1", null), hero_image_url: "recipe-images/owner/top1/hero.webp" }]),
      fetchPopular: vi.fn(async () => [{ ...row("rec1", null), hero_image_url: "recipe-images/owner/rec1/hero.webp" }]),
      resolveHeroImages: vi.fn(async (rows: RawRecipeRow[]) => rows.map((recipe) => ({
        ...recipe,
        hero_image_url: `https://signed.example/${recipe.id}`,
      }))),
    });
    const res = await buildHomeResponse(deps, { userId: null, limit: 10, topLimit: 1 });
    expect(res.top_recipes[0].hero_image_url).toBe("https://signed.example/top1");
    expect(res.recommended[0].hero_image_url).toBe("https://signed.example/rec1");
  });
  it("비인증(userId=null)이면 인사말 null, 좋아요·저장 모두 false", async () => {
    const deps = makeDeps();
    const res = await buildHomeResponse(deps, { userId: null, limit: 10, topLimit: 2 });

    expect(res.greeting_name).toBeNull();
    expect(deps.fetchViewer).not.toHaveBeenCalled();
    expect(deps.fetchInteractions).not.toHaveBeenCalled();
    expect(res.recommended.every((r) => !r.is_liked && !r.is_saved)).toBe(true);
    expect(res.next_cursor).toBeNull();
  });

  it("TOP에 rank를 매기고, 추천에서 TOP을 제외한다", async () => {
    const deps = makeDeps();
    const res = await buildHomeResponse(deps, { userId: "u1", limit: 10, topLimit: 2 });

    expect(res.top_recipes).toEqual([
      { recipe_id: "top1", title: "top1", hero_image_url: null, rank: 1 },
      { recipe_id: "top2", title: "top2", hero_image_url: null, rank: 2 },
    ]);
    const recIds = res.recommended.map((r) => r.recipe_id);
    expect(recIds).not.toContain("top1");
    expect(recIds).not.toContain("top2");
  });

  it("fetchMonthlyTop을 top_recipes에, fetchPopular를 추천 풀에 각각 사용한다", async () => {
    const monthlyRows = [row("m1", "27110"), row("m2", "47170")];
    const deps = makeDeps({
      fetchMonthlyTop: vi.fn(async () => monthlyRows),
    });
    const res = await buildHomeResponse(deps, { userId: null, limit: 10, topLimit: 2 });

    expect(deps.fetchMonthlyTop).toHaveBeenCalledWith({ limit: 2 });
    expect(res.top_recipes.map((r) => r.recipe_id)).toEqual(["m1", "m2"]);
    const recIds = res.recommended.map((r) => r.recipe_id);
    expect(recIds).not.toContain("m1");
    expect(recIds).not.toContain("m2");
  });

  it("인증 시 인사말과 좋아요 상태를 반영하고 같은 지역을 우선한다", async () => {
    const deps = makeDeps();
    const res = await buildHomeResponse(deps, { userId: "u1", limit: 10, topLimit: 2 });

    expect(res.greeting_name).toBe("김한솔");
    expect(res.recommended[0].recipe_id).toBe("rec1"); // 47170, 지역 우선
    expect(res.recommended.find((r) => r.recipe_id === "rec1")?.is_liked).toBe(true);
  });
});
