-- s04_publish: 발행 시 전승자 프로필의 region_code / region을 레시피에 복사
CREATE OR REPLACE FUNCTION s04_publish(p_owner UUID, p_recipe UUID, p_analysis JSONB)
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
    UPDATE recipes
    SET status      = 'published',
        visibility  = 'public',
        region_code = (SELECT region_code FROM profiles WHERE id = p_owner),
        region      = (SELECT region      FROM profiles WHERE id = p_owner),
        updated_at  = now()
    WHERE id = p_recipe
      AND transmitter_id = p_owner;
  END IF;
  RETURN jsonb_build_object('recipe_id', p_recipe, 'status', 'published', 'context_summary', COALESCE(v_card.context_summary, ''), 'voice_message_url', v_card.voice_message_url);
END;
$$;
