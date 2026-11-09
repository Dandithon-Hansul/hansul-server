import {
  toTopCard,
  toRecommendedCard,
  type RawRecipeRow,
  type TopCard,
  type RecommendedCard,
  type InteractionSets,
} from "./dto/recipe";
import { selectRecommended } from "./home";

export interface Viewer {
  display_name: string;
  region_code: string | null;
}

export interface HomeDeps {
  fetchMonthlyTop(opts: { limit: number }): Promise<RawRecipeRow[]>;
  fetchPopular(opts: { regionCode: string | null; limit: number }): Promise<RawRecipeRow[]>;
  fetchViewer(userId: string): Promise<Viewer | null>;
  fetchInteractions(userId: string, recipeIds: string[]): Promise<InteractionSets>;
  resolveHeroImageUrl(url: string | null, transmitterId: string, recipeId: string): Promise<string | null>;
}

export interface HomeResponse {
  greeting_name: string | null;
  top_recipes: TopCard[];
  recommended: RecommendedCard[];
  next_cursor: null;
}

// 추천 후보 풀 크기. 지역 우선 재정렬 여지를 두기 위해 limit보다 넉넉히 가져온다.
const RECOMMEND_POOL = 30;

const EMPTY_INTERACTIONS: InteractionSets = {
  likedIds: new Set<string>(),
  savedIds: new Set<string>(),
};

export async function buildHomeResponse(
  deps: HomeDeps,
  { userId, limit, topLimit }: { userId: string | null; limit: number; topLimit: number },
): Promise<HomeResponse> {
  const [viewer, topRows, pool] = await Promise.all([
    userId ? deps.fetchViewer(userId) : Promise.resolve(null),
    deps.fetchMonthlyTop({ limit: topLimit }),
    deps.fetchPopular({ regionCode: null, limit: RECOMMEND_POOL }),
  ]);
  const recRows = selectRecommended(pool, {
    regionCode: viewer?.region_code ?? null,
    excludeIds: new Set(topRows.map((r) => r.id)),
    limit,
  });

  const [top_recipes, interactions, recommendedUrls] = await Promise.all([
    Promise.all(topRows.map(async (r, i) => ({
      ...toTopCard(r, i + 1),
      hero_image_url: await deps.resolveHeroImageUrl(r.hero_image_url, r.transmitter_id, r.id),
    }))),
    userId && recRows.length > 0
      ? deps.fetchInteractions(userId, recRows.map((r) => r.id))
      : Promise.resolve(EMPTY_INTERACTIONS),
    Promise.all(recRows.map((r) =>
      deps.resolveHeroImageUrl(r.hero_image_url, r.transmitter_id, r.id),
    )),
  ]);

  const recommended = recRows.map((r, i) => ({
    ...toRecommendedCard(r, interactions),
    hero_image_url: recommendedUrls[i],
  }));

  return {
    greeting_name: viewer?.display_name ?? null,
    top_recipes,
    recommended,
    next_cursor: null,
  };
}
