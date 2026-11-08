ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

CREATE OR REPLACE FUNCTION public.toggle_recipe_interaction(p_recipe_id uuid, p_profile_id uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target public.recipes%ROWTYPE;
  liked boolean;
  saved boolean;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('like', 'save') THEN
    RAISE EXCEPTION 'Invalid interaction kind' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target FROM public.recipes WHERE id = p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found' USING ERRCODE = 'P0002';
  END IF;
  IF (target.status <> 'published' OR target.visibility <> 'public')
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Interaction forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_kind = 'like' THEN
    DELETE FROM public.recipe_likes WHERE recipe_id = p_recipe_id AND profile_id = p_profile_id;
    IF NOT FOUND THEN
      INSERT INTO public.recipe_likes (recipe_id, profile_id) VALUES (p_recipe_id, p_profile_id);
    END IF;
  ELSE
    DELETE FROM public.recipe_saves WHERE recipe_id = p_recipe_id AND profile_id = p_profile_id;
    IF NOT FOUND THEN
      INSERT INTO public.recipe_saves (recipe_id, profile_id) VALUES (p_recipe_id, p_profile_id);
    END IF;
  END IF;

  UPDATE public.recipes
  SET like_count = (SELECT count(*) FROM public.recipe_likes WHERE recipe_id = p_recipe_id),
      save_count = (SELECT count(*) FROM public.recipe_saves WHERE recipe_id = p_recipe_id)
  WHERE id = p_recipe_id
  RETURNING * INTO target;

  SELECT EXISTS (SELECT 1 FROM public.recipe_likes WHERE recipe_id = p_recipe_id AND profile_id = p_profile_id),
         EXISTS (SELECT 1 FROM public.recipe_saves WHERE recipe_id = p_recipe_id AND profile_id = p_profile_id)
  INTO liked, saved;

  RETURN jsonb_build_object(
    'recipe_id', p_recipe_id, 'liked', liked, 'saved', saved,
    'like_count', target.like_count, 'save_count', target.save_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_recipe_interaction(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_recipe_interaction(uuid, uuid, text) TO service_role;

-- Public profile reads expose only a transmitter's public, published recipes.
CREATE OR REPLACE FUNCTION public.get_public_transmitter(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'profile_id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
    'region', p.region, 'bio', p.bio,
    'recipe_count', stats.recipe_count, 'received_like_count', stats.received_like_count,
    'recipes', COALESCE(cards.items, '[]'::jsonb)
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
  WHERE p.id = p_profile_id AND stats.recipe_count > 0;
$$;

REVOKE ALL ON FUNCTION public.get_public_transmitter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_transmitter(uuid) TO service_role;
