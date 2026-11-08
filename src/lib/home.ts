import type { RawRecipeRow } from "./dto/recipe";

export interface RecommendOptions {
  regionCode: string | null;
  excludeIds: Set<string>;
  limit: number;
}

// 추천 선별: TOP 중복 제거 → 같은 지역 우선 → 나머지 인기순.
// 입력(candidates)은 이미 인기순으로 정렬되어 있다고 가정한다.
export function selectRecommended(
  candidates: RawRecipeRow[],
  { regionCode, excludeIds, limit }: RecommendOptions,
): RawRecipeRow[] {
  const filtered = candidates.filter((r) => !excludeIds.has(r.id));

  if (!regionCode) return filtered.slice(0, limit);

  const sameRegion = filtered.filter((r) => r.region_code === regionCode);
  const others = filtered.filter((r) => r.region_code !== regionCode);

  return [...sameRegion, ...others].slice(0, limit);
}
