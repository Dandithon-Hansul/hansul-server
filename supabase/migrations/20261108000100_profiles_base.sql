CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT        NOT NULL,
  region           TEXT,
  region_code      TEXT,
  avatar_url       TEXT,
  food_preferences JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sensory_vector   vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Legacy projects may already contain this profile column and historical values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
  END IF;
END;
$$;

DROP POLICY IF EXISTS own_profile ON public.profiles;
CREATE POLICY own_profile ON public.profiles
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
