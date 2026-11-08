INSERT INTO storage.buckets (id, name, public)
VALUES ('card-voice', 'card-voice', false)
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION public.s04_publish_with_quote(p_owner uuid, p_recipe uuid, p_analysis jsonb, p_quote text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  current_status text;
  saved_quote text;
  result jsonb;
BEGIN
  SELECT status, transmitter_quote INTO current_status, saved_quote
  FROM public.recipes
  WHERE id = p_recipe AND transmitter_id = p_owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'S04_NOT_FOUND';
  END IF;

  result := public.s04_publish(p_owner, p_recipe, p_analysis);
  IF current_status = 'draft' AND p_quote IS NOT NULL THEN
    UPDATE public.recipes SET transmitter_quote = p_quote
    WHERE id = p_recipe AND transmitter_id = p_owner
    RETURNING transmitter_quote INTO saved_quote;
  END IF;

  RETURN result || jsonb_build_object('transmitter_quote', saved_quote);
END;
$$;

REVOKE ALL ON FUNCTION public.s04_publish_with_quote(uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.s04_publish_with_quote(uuid, uuid, jsonb, text) TO service_role;
