import { describe, it, expect } from "vitest";
import {
  toTopCard,
  toRecommendedCard,
  toSearchCard,
  toPopularCard,
  type RawRecipeRow,
} from "./recipe";

const baseRow: RawRecipeRow = {
  id: "a0000001-0000-0000-0000-000000000001",
  title: "안동 찜닭",
  hero_image_url: "https://example.com/jjimdak.webp",
  transmitter_quote: "간장은 한 번에 붓지 말고",
  like_count: 162,
  save_count: 102,
  region: "안동시 정하동",
  region_code: "47170",
  created_at: "2026-11-01T00:00:00.000Z",
  transmitter: { display_name: "김영희" },
};

describe("toTopCard", () => {
  it("rank를 포함한 TOP 카드를 만든다", () => {
    expect(toTopCard(baseRow, 1)).toEqual({
      recipe_id: "a0000001-0000-0000-0000-000000000001",
      title: "안동 찜닭",
      hero_image_url: "https://example.com/jjimdak.webp",
      rank: 1,
    });
  });
});

describe("toRecommendedCard", () => {
  it("좋아요·저장 집합으로 is_liked/is_saved를 계산한다", () => {
    const card = toRecommendedCard(baseRow, {
      likedIds: new Set<string>(),
      savedIds: new Set(["a0000001-0000-0000-0000-000000000001"]),
    });
    expect(card).toEqual({
      recipe_id: "a0000001-0000-0000-0000-000000000001",
      title: "안동 찜닭",
      hero_image_url: "https://example.com/jjimdak.webp",
      region_tag: "안동시 정하동",
      transmitter_name: "김영희",
      transmitter_quote: "간장은 한 번에 붓지 말고",
      like_count: 162,
      save_count: 102,
      is_liked: false,
      is_saved: true,
    });
  });

  it("집합이 비어 있으면 둘 다 false", () => {
    const card = toRecommendedCard(baseRow, {
      likedIds: new Set<string>(),
      savedIds: new Set<string>(),
    });
    expect(card.is_liked).toBe(false);
    expect(card.is_saved).toBe(false);
  });
});

describe("toSearchCard", () => {
  it("검색 결과 카드를 만든다", () => {
    expect(toSearchCard(baseRow)).toEqual({
      recipe_id: "a0000001-0000-0000-0000-000000000001",
      title: "안동 찜닭",
      hero_image_url: "https://example.com/jjimdak.webp",
      transmitter_name: "김영희",
      region_tag: "안동시 정하동",
      like_count: 162,
    });
  });
});

describe("toPopularCard", () => {
  it("인기 목록 카드를 만든다", () => {
    expect(toPopularCard(baseRow)).toEqual({
      recipe_id: "a0000001-0000-0000-0000-000000000001",
      title: "안동 찜닭",
      hero_image_url: "https://example.com/jjimdak.webp",
      transmitter_name: "김영희",
      region: "안동시 정하동",
      like_count: 162,
      created_at: "2026-11-01T00:00:00.000Z",
    });
  });

  it("transmitter가 없으면 transmitter_name은 null", () => {
    const card = toPopularCard({ ...baseRow, transmitter: null });
    expect(card.transmitter_name).toBeNull();
  });
});
