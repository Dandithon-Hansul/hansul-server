-- get_monthly_top_recipes 반환에 transmitter_id 추가 (hero_image_url signed URL 생성에 필요)
DROP FUNCTION IF EXISTS public.get_monthly_top_recipes(int);
CREATE OR REPLACE FUNCTION public.get_monthly_top_recipes(p_limit int DEFAULT 6)
RETURNS TABLE (
  id uuid,
  title text,
  hero_image_url text,
  transmitter_id uuid,
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
    sub.id, sub.title, sub.hero_image_url, sub.transmitter_id, sub.transmitter_quote,
    sub.like_count, sub.save_count, sub.region, sub.region_code,
    sub.created_at, sub.transmitter_display_name
  FROM (
    SELECT
      r.id, r.title, r.hero_image_url, r.transmitter_id, r.transmitter_quote,
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

UPDATE public.recipes AS recipe
SET hero_image_url = images.url
FROM (VALUES
  ('a0000001-0000-0000-0000-000000000001'::uuid, 'https://picsum.photos/seed/jjimdak/800'),
  ('a0000002-0000-0000-0000-000000000002'::uuid, 'https://picsum.photos/seed/sikhye/800'),
  ('a0000003-0000-0000-0000-000000000003'::uuid, 'https://picsum.photos/seed/godeungeo/800'),
  ('a0000004-0000-0000-0000-000000000004'::uuid, 'https://picsum.photos/seed/daegutang/800'),
  ('a0000005-0000-0000-0000-000000000005'::uuid, 'https://picsum.photos/seed/mungtigi/800'),
  ('a0000006-0000-0000-0000-000000000006'::uuid, 'https://picsum.photos/seed/ssambap/800')
) AS images(id, url)
WHERE recipe.id = images.id
  AND recipe.hero_image_url IS NOT NULL
  AND recipe.hero_image_url !~ '^https://'
  AND recipe.hero_image_url !~ '^recipe-images/';
