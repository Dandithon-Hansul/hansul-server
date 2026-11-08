CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT        NOT NULL,
  region           TEXT,
  region_code      TEXT,
  dong             TEXT,
  avatar_url       TEXT,
  food_preferences JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sensory_vector   vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_profile ON public.profiles
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
