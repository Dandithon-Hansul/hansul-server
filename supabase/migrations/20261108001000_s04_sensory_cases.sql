ALTER TABLE chat_messages ADD COLUMN s04_sequence BIGINT GENERATED ALWAYS AS IDENTITY;
CREATE INDEX idx_chat_messages_s04_sequence ON chat_messages(recipe_id, s04_sequence);

ALTER TABLE transmission_cards ADD COLUMN s04_last_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

CREATE TABLE sensory_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmitter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  expression TEXT NOT NULL,
  dimension TEXT NOT NULL,
  context TEXT NOT NULL,
  food_name TEXT NOT NULL,
  resolved_value TEXT NOT NULL,
  evidence TEXT NOT NULL,
  embedding vector(1536),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, expression, dimension, context)
);
CREATE INDEX idx_sensory_cases_owner ON sensory_cases(transmitter_id, expression, dimension);
ALTER TABLE sensory_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sensory_cases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON sensory_cases TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tts', 'tts', false, 10485760, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION s04_append_message(p_owner UUID, p_recipe UUID, p_role TEXT, p_content TEXT, p_image TEXT, p_audio TEXT)
RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM 1 FROM recipes WHERE id = p_recipe AND transmitter_id = p_owner AND status = 'draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'S04_NOT_DRAFT'; END IF;
  INSERT INTO chat_messages(recipe_id, role, content, image_url, audio_url)
    VALUES(p_recipe, p_role, p_content, p_image, p_audio) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION s04_save_analysis(p_owner UUID, p_recipe UUID, p_analysis JSONB, p_last_message UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_last UUID;
BEGIN
  PERFORM 1 FROM recipes WHERE id = p_recipe AND transmitter_id = p_owner AND status = 'draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'S04_NOT_DRAFT'; END IF;
  SELECT id INTO v_last FROM chat_messages WHERE recipe_id = p_recipe ORDER BY s04_sequence DESC LIMIT 1;
  IF v_last IS DISTINCT FROM p_last_message THEN RAISE EXCEPTION 'S04_STALE_ANALYSIS'; END IF;
  UPDATE recipes SET title = NULLIF(btrim(p_analysis #>> '{recipe,food_name}'), ''),
    ingredients = p_analysis #> '{recipe,ingredients}',
    steps = (SELECT COALESCE(jsonb_agg(s || jsonb_build_object('title', s->>'action', 'description', s->>'action', 'tip', s->'rationale', 'is_key_step', false)), '[]'::jsonb)
             FROM jsonb_array_elements(p_analysis #> '{recipe,steps}') s),
    updated_at = now()
    WHERE id = p_recipe AND transmitter_id = p_owner;
  INSERT INTO transmission_cards(recipe_id, ai_analysis, s04_last_message_id, context_summary)
    VALUES(p_recipe, jsonb_build_object('interview', p_analysis, 'must_keep', p_analysis #> '{card,must_keep}', 'can_change', p_analysis #> '{card,can_change}', 'unresolved', p_analysis #> '{card,unresolved}', 'context', p_analysis #> '{card,context}'), p_last_message, concat_ws(' · ', p_analysis #>> '{card,context,occasion}', p_analysis #>> '{card,context,for_whom}'))
    ON CONFLICT(recipe_id) DO UPDATE SET ai_analysis = EXCLUDED.ai_analysis, s04_last_message_id = EXCLUDED.s04_last_message_id, context_summary = EXCLUDED.context_summary, updated_at = now();
END;
$$;

CREATE FUNCTION s04_publish(p_owner UUID, p_recipe UUID, p_analysis JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_recipe recipes; v_card transmission_cards; v_last UUID;
BEGIN
  SELECT * INTO v_recipe FROM recipes WHERE id = p_recipe AND transmitter_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'S04_NOT_FOUND'; END IF;
  SELECT * INTO v_card FROM transmission_cards WHERE recipe_id = p_recipe;
  IF v_recipe.status <> 'published' THEN
    SELECT id INTO v_last FROM chat_messages WHERE recipe_id = p_recipe ORDER BY s04_sequence DESC LIMIT 1;
    IF v_card.ai_analysis->'interview' IS DISTINCT FROM p_analysis OR v_card.s04_last_message_id IS DISTINCT FROM v_last THEN RAISE EXCEPTION 'S04_STALE_ANALYSIS'; END IF;
    IF NOT EXISTS (SELECT 1 FROM sensory_cases WHERE recipe_id = p_recipe AND transmitter_id = p_owner) THEN RAISE EXCEPTION 'S04_SENSORY_INSUFFICIENT'; END IF;
    IF v_recipe.title IS NULL OR btrim(v_recipe.title) = '' OR jsonb_array_length(v_recipe.ingredients) = 0 OR jsonb_array_length(v_recipe.steps) = 0 THEN RAISE EXCEPTION 'S04_ANALYSIS_REQUIRED'; END IF;
    UPDATE recipes SET status = 'published', visibility = 'public', updated_at = now() WHERE id = p_recipe AND transmitter_id = p_owner;
  END IF;
  RETURN jsonb_build_object('recipe_id', p_recipe, 'status', 'published', 'context_summary', COALESCE(v_card.context_summary, ''), 'voice_message_url', v_card.voice_message_url);
END;
$$;

REVOKE ALL ON FUNCTION s04_append_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION s04_save_analysis(UUID, UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION s04_publish(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION s04_append_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION s04_save_analysis(UUID, UUID, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION s04_publish(UUID, UUID, JSONB) TO service_role;
