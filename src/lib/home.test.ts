import { describe, it, expect } from "vitest";
import { selectRecommended } from "./home";
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

describe("selectRecommended", () => {
  // 입력은 이미 인기순으로 정렬되어 있다고 가정한다.
  const candidates = [
    row("pop1", "27110"),
    row("pop2", "47170"),
    row("pop3", "27110"),
    row("pop4", "47170"),
  ];

  it("같은 지역 레시피를 인기순보다 먼저 배치한다", () => {
    const result = selectRecommended(candidates, {
      regionCode: "47170",
      excludeIds: new Set<string>(),
      limit: 10,
    });
    expect(result.map((r) => r.id)).toEqual(["pop2", "pop4", "pop1", "pop3"]);
  });

  it("excludeIds(=TOP)에 있는 레시피는 제외한다", () => {
    const result = selectRecommended(candidates, {
      regionCode: "47170",
      excludeIds: new Set(["pop2"]),
      limit: 10,
    });
    expect(result.map((r) => r.id)).toEqual(["pop4", "pop1", "pop3"]);
  });

  it("limit을 넘지 않는다", () => {
    const result = selectRecommended(candidates, {
      regionCode: "47170",
      excludeIds: new Set<string>(),
      limit: 2,
    });
    expect(result.map((r) => r.id)).toEqual(["pop2", "pop4"]);
  });

  it("regionCode가 null이면 인기순을 유지한다", () => {
    const result = selectRecommended(candidates, {
      regionCode: null,
      excludeIds: new Set<string>(),
      limit: 10,
    });
    expect(result.map((r) => r.id)).toEqual(["pop1", "pop2", "pop3", "pop4"]);
  });
});
