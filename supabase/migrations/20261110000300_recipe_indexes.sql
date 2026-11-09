-- 레시피 목록 및 검색 최적화를 위한 부분 복합 인덱스 및 pg_trgm 인덱스

-- 1. pg_trgm 확장 활성화 (와일드카드 텍스트 검색 가속)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 공개 레시피 대상 부분 복합 인덱스 (인기순 정렬)
-- fetchRecipeList (sort="popular"):
-- WHERE status = 'published' AND visibility = 'public' ORDER BY popularity_score DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_recipes_published_popular
  ON public.recipes (popularity_score DESC, created_at DESC)
  WHERE status = 'published' AND visibility = 'public';

-- 3. 공개 레시피 대상 부분 복합 인덱스 (최신순 정렬)
-- fetchRecipeList (sort="recent"):
-- WHERE status = 'published' AND visibility = 'public' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_recipes_published_recent
  ON public.recipes (created_at DESC)
  WHERE status = 'published' AND visibility = 'public';

-- 4. 공개 레시피 대상 지역 필터 + 정렬 복합 인덱스
-- WHERE status = 'published' AND visibility = 'public' AND region_code = :regionCode
CREATE INDEX IF NOT EXISTS idx_recipes_published_region
  ON public.recipes (region_code, popularity_score DESC, created_at DESC)
  WHERE status = 'published' AND visibility = 'public';

-- 5. 검색 가속을 위한 GIN Trigram 인덱스 (제목 및 지역 와일드카드 검색)
-- searchRecipes:
-- WHERE status = 'published' AND visibility = 'public' AND (title.ilike.%term% OR region.ilike.%term%)
CREATE INDEX IF NOT EXISTS idx_recipes_title_trgm
  ON public.recipes USING gin (title gin_trgm_ops)
  WHERE status = 'published' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_recipes_region_trgm
  ON public.recipes USING gin (region gin_trgm_ops)
  WHERE status = 'published' AND visibility = 'public';
