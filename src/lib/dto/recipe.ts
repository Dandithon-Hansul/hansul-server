// 공개 레시피 응답 DTO 매퍼.
// transcript·ai_analysis 등 내부 인터뷰 데이터는 입력 타입에서부터 제외한다.

export interface RawTransmitter {
  display_name: string | null;
}

export interface RawRecipeRow {
  id: string;
  title: string | null;
  hero_image_url: string | null;
  transmitter_quote: string | null;
  like_count: number;
  save_count: number;
  region: string | null;
  region_code: string | null;
  created_at: string;
  transmitter: RawTransmitter | null;
}

export interface TopCard {
  recipe_id: string;
  title: string | null;
  hero_image_url: string | null;
  rank: number;
}

export interface RecommendedCard {
  recipe_id: string;
  title: string | null;
  hero_image_url: string | null;
  region_tag: string | null;
  transmitter_name: string | null;
  transmitter_quote: string | null;
  like_count: number;
  save_count: number;
  is_liked: boolean;
  is_saved: boolean;
}

export interface SearchCard {
  recipe_id: string;
  title: string | null;
  hero_image_url: string | null;
  transmitter_name: string | null;
  region_tag: string | null;
  like_count: number;
}

export interface PopularCard {
  recipe_id: string;
  title: string | null;
  hero_image_url: string | null;
  transmitter_name: string | null;
  region: string | null;
  like_count: number;
  created_at: string;
}

export interface InteractionSets {
  likedIds: Set<string>;
  savedIds: Set<string>;
}

function transmitterName(row: RawRecipeRow): string | null {
  return row.transmitter?.display_name ?? null;
}

export function toTopCard(row: RawRecipeRow, rank: number): TopCard {
  return {
    recipe_id: row.id,
    title: row.title,
    hero_image_url: row.hero_image_url,
    rank,
  };
}

export function toRecommendedCard(
  row: RawRecipeRow,
  interactions: InteractionSets,
): RecommendedCard {
  return {
    recipe_id: row.id,
    title: row.title,
    hero_image_url: row.hero_image_url,
    region_tag: row.region,
    transmitter_name: transmitterName(row),
    transmitter_quote: row.transmitter_quote,
    like_count: row.like_count,
    save_count: row.save_count,
    is_liked: interactions.likedIds.has(row.id),
    is_saved: interactions.savedIds.has(row.id),
  };
}

export function toSearchCard(row: RawRecipeRow): SearchCard {
  return {
    recipe_id: row.id,
    title: row.title,
    hero_image_url: row.hero_image_url,
    transmitter_name: transmitterName(row),
    region_tag: row.region,
    like_count: row.like_count,
  };
}

export function toPopularCard(row: RawRecipeRow): PopularCard {
  return {
    recipe_id: row.id,
    title: row.title,
    hero_image_url: row.hero_image_url,
    transmitter_name: transmitterName(row),
    region: row.region,
    like_count: row.like_count,
    created_at: row.created_at,
  };
}
