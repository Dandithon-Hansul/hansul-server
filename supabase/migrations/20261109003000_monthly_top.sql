-- recipe_likes에 타임스탬프 추가 (기존 행은 월별 집계에서 제외)
ALTER TABLE public.recipe_likes
  ADD COLUMN liked_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS recipe_likes_liked_at_idx ON public.recipe_likes (liked_at);
CREATE INDEX IF NOT EXISTS recipe_saves_saved_at_idx ON public.recipe_saves (saved_at);

-- 이달의 top 레시피: 캘린더 월 기준 좋아요+저장 집계
CREATE OR REPLACE FUNCTION public.get_monthly_top_recipes(p_limit int DEFAULT 6)
RETURNS TABLE (
  id uuid,
  title text,
  hero_image_url text,
  transmitter_quote text,
  like_count int,
  save_count int,
  region text,
  region_code text,
  created_at timestamptz,
  transmitter_display_name text
)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT
    sub.id, sub.title, sub.hero_image_url, sub.transmitter_quote,
    sub.like_count, sub.save_count, sub.region, sub.region_code,
    sub.created_at, sub.transmitter_display_name
  FROM (
    SELECT
      r.id, r.title, r.hero_image_url, r.transmitter_quote,
      r.like_count, r.save_count, r.region, r.region_code, r.created_at,
      p.display_name AS transmitter_display_name,
      COUNT(DISTINCT rl.profile_id) + COUNT(DISTINCT rs.profile_id) AS monthly_score
    FROM public.recipes r
    LEFT JOIN public.profiles p ON p.id = r.transmitter_id
    LEFT JOIN public.recipe_likes rl
      ON rl.recipe_id = r.id
      AND date_trunc('month', rl.liked_at AT TIME ZONE 'Asia/Seoul') = date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')
    LEFT JOIN public.recipe_saves rs
      ON rs.recipe_id = r.id
      AND date_trunc('month', rs.saved_at AT TIME ZONE 'Asia/Seoul') = date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')
    WHERE r.status = 'published' AND r.visibility = 'public'
    GROUP BY r.id, p.display_name
  ) sub
  ORDER BY sub.monthly_score DESC, sub.created_at DESC
  LIMIT p_limit
$$;

REVOKE ALL ON FUNCTION public.get_monthly_top_recipes(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_top_recipes(int) TO service_role;
