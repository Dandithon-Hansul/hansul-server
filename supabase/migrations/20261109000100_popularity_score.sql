ALTER TABLE public.recipes
  ADD COLUMN popularity_score INTEGER GENERATED ALWAYS AS (like_count + save_count) STORED;

CREATE INDEX IF NOT EXISTS recipes_popularity_score_idx ON public.recipes (popularity_score DESC);
