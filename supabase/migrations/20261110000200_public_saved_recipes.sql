CREATE OR REPLACE FUNCTION public.get_public_transmitter(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'profile_id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
    'region', p.region, 'bio', p.bio,
    'recipe_count', stats.recipe_count, 'received_like_count', stats.received_like_count,
    'recipes', COALESCE(cards.items, '[]'::jsonb),
    'saved_recipe_count', saved.saved_recipe_count,
    'saved_recipes', COALESCE(saved.items, '[]'::jsonb)
  )
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT count(*) AS recipe_count, COALESCE(sum(like_count), 0) AS received_like_count
    FROM public.recipes
    WHERE transmitter_id = p.id AND status = 'published' AND visibility = 'public'
  ) stats
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'recipe_id', r.id, 'title', r.title,
        'hero_image_url', r.hero_image_url
      ) ORDER BY r.created_at DESC, r.id DESC
    ) AS items
    FROM (
      SELECT id, title, hero_image_url, created_at
      FROM public.recipes
      WHERE transmitter_id = p.id AND status = 'published' AND visibility = 'public'
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    ) r
  ) cards
  CROSS JOIN LATERAL (
    SELECT count(*) AS saved_recipe_count,
      jsonb_agg(jsonb_build_object(
        'recipe_id', r.id, 'title', r.title, 'hero_image_url', r.hero_image_url,
        'transmitter_id', r.transmitter_id, 'transmitter_name', t.display_name
      ) ORDER BY s.saved_at DESC, s.id DESC) AS items
    FROM public.recipe_saves s
    JOIN public.recipes r ON r.id = s.recipe_id
    LEFT JOIN public.profiles t ON t.id = r.transmitter_id
    WHERE s.profile_id = p.id AND r.status = 'published' AND r.visibility = 'public'
  ) saved
  WHERE p.id = p_profile_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_transmitter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_transmitter(uuid) TO service_role;
