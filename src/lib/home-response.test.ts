import { describe, it, expect, vi } from "vitest";
import { buildHomeResponse, type HomeDeps } from "./home-response";
import type { RawRecipeRow } from "./dto/recipe";

function row(id: string, regionCode: string | null): RawRecipeRow {
  return {
    id,
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
    fetchPopular: vi.fn(async ({ limit }) => pool.slice(0, limit)),
    fetchViewer: vi.fn(async () => ({ display_name: "김한솔", region_code: "47170" })),
    fetchInteractions: vi.fn(async () => ({
      likedIds: new Set(["rec1"]),
      savedIds: new Set<string>(),
    })),
    ...overrides,
  };
}

describe("buildHomeResponse", () => {
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

  it("인증 시 인사말과 좋아요 상태를 반영하고 같은 지역을 우선한다", async () => {
    const deps = makeDeps();
    const res = await buildHomeResponse(deps, { userId: "u1", limit: 10, topLimit: 2 });

    expect(res.greeting_name).toBe("김한솔");
    expect(res.recommended[0].recipe_id).toBe("rec1"); // 47170, 지역 우선
    expect(res.recommended.find((r) => r.recipe_id === "rec1")?.is_liked).toBe(true);
  });
});
