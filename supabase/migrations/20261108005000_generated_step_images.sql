INSERT INTO storage.buckets (id, name, public)
VALUES ('step-images', 'step-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION public.save_generated_step_image(p_owner uuid, p_recipe uuid, p_order integer, p_path text)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  recipe_steps jsonb;
  step_index integer;
  image_path text;
BEGIN
  SELECT steps INTO recipe_steps
  FROM public.recipes
  WHERE id = p_recipe AND transmitter_id = p_owner AND status = 'published'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published recipe not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT ordinality::integer - 1, NULLIF(step->>'image_url', '')
  INTO step_index, image_path
  FROM jsonb_array_elements(recipe_steps) WITH ORDINALITY AS items(step, ordinality)
  WHERE (step->>'order')::integer = p_order;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Step not found' USING ERRCODE = 'P0002';
  END IF;

  IF image_path IS NOT NULL THEN
    RETURN image_path;
  END IF;

  UPDATE public.recipes
  SET steps = jsonb_set(recipe_steps, ARRAY[step_index::text, 'image_url'], to_jsonb(p_path))
  WHERE id = p_recipe;

  RETURN p_path;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_step_image(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_generated_step_image(uuid, uuid, integer, text) TO service_role;
