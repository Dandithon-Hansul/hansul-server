CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL CHECK (role IN ('transmitter', 'learner')),
  display_name        TEXT NOT NULL,
  region              TEXT,
  region_code         TEXT,
  avatar_url          TEXT,
  bio                 TEXT,
  food_preferences    JSONB NOT NULL DEFAULT '[]'::jsonb,
  sensory_vector      vector(1536),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.recipes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmitter_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  CHECK (status <> 'published' OR (title IS NOT NULL AND length(btrim(title)) > 0)),
  hero_image_url      TEXT,
  transmitter_quote   TEXT,
  cooking_time        INT CHECK (cooking_time > 0),
  difficulty          TEXT CHECK (difficulty IN ('쉬움', '보통', '어려움')),
  servings            INT CHECK (servings > 0),
  ingredients         JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps               JSONB NOT NULL DEFAULT '[]'::jsonb,
  like_count          INT NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  save_count          INT NOT NULL DEFAULT 0 CHECK (save_count >= 0),
  visibility          TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  version             INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  region              TEXT,
  region_code         TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  audio_url           TEXT,
  transcript          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transmission_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  ai_analysis         JSONB NOT NULL DEFAULT '{}'::jsonb,
  context_summary     TEXT,
  voice_message_url   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.recipe_saves (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saved_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, profile_id)
);

CREATE TABLE public.recipe_likes (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, profile_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transmission_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recipes, public.transmission_cards, public.recipe_saves, public.recipe_likes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.recipes, public.transmission_cards, public.recipe_saves, public.recipe_likes TO service_role;

CREATE POLICY own_profile ON public.profiles
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE INDEX recipes_public_transmitter_idx
  ON public.recipes (transmitter_id, created_at DESC, id DESC)
  WHERE status = 'published' AND visibility = 'public';

CREATE FUNCTION public.toggle_recipe_interaction(p_recipe_id uuid, p_profile_id uuid, p_kind text)
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
CREATE FUNCTION public.get_public_transmitter(p_profile_id uuid)
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
  WHERE p.id = p_profile_id AND p.role = 'transmitter';
$$;

REVOKE ALL ON FUNCTION public.get_public_transmitter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_transmitter(uuid) TO service_role;
