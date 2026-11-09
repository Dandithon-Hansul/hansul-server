-- 프로필 전승/저장 통계 및 지도 지역별 레시피 수 단일 집계 RPC

-- 1. 프로필 통계 집계 RPC (전승 레시피 수, 받은 좋아요 수, 저장한 레시피 수)
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'transmitted_recipes', COALESCE((
      SELECT count(*)::int
      FROM public.recipes
      WHERE transmitter_id = p_profile_id AND status = 'published'
    ), 0),
    'likes_received', COALESCE((
      SELECT sum(like_count)::int
      FROM public.recipes
      WHERE transmitter_id = p_profile_id AND status = 'published'
    ), 0),
    'saved_recipes', COALESCE((
      SELECT count(*)::int
      FROM public.recipe_saves s
      JOIN public.recipes r ON r.id = s.recipe_id
      WHERE s.profile_id = p_profile_id
        AND r.status = 'published'
        AND r.visibility = 'public'
    ), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.get_profile_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(uuid) TO service_role;

-- 2. 지도 지역별 공개 레시피 수 집계 RPC
CREATE OR REPLACE FUNCTION public.get_map_region_counts()
RETURNS TABLE(region_code text, recipe_count bigint)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN region_code LIKE '27%' THEN '27000'
      ELSE region_code
    END AS region_code,
    count(*) AS recipe_count
  FROM public.recipes
  WHERE status = 'published'
    AND visibility = 'public'
    AND region_code IS NOT NULL
  GROUP BY
    CASE
      WHEN region_code LIKE '27%' THEN '27000'
      ELSE region_code
    END;
$$;

REVOKE ALL ON FUNCTION public.get_map_region_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_region_counts() TO service_role;
