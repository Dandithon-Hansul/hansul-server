-- 공통 스키마와 S-04 마이그레이션이 적용된 폐기 가능한 테스트 DB에서만 실행한다.
BEGIN;
DO $$
<<s04_interview>>
DECLARE
  owner_id UUID := '10000000-0000-4000-8000-000000000001';
  other_id UUID := '10000000-0000-4000-8000-000000000002';
  recipe_id UUID := '20000000-0000-4000-8000-000000000001';
  msg_id UUID;
  analysis JSONB := '{"recipe":{"food_name":"나물무침","ingredients":[{"name":"소금","amount":null,"unit":null}],"steps":[{"order":1,"action":"무친다","rationale":null}]},"card":{"must_keep":[],"can_change":[],"unresolved":[],"context":{"occasion":"가족 식사","for_whom":"가족"}}}'::jsonb;
  result JSONB;
BEGIN
  INSERT INTO auth.users(id) VALUES(owner_id), (other_id);
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN
    EXECUTE 'INSERT INTO profiles(id,role,display_name) VALUES($1,''transmitter'',''테스트 전승자''),($2,''transmitter'',''다른 사용자'')' USING owner_id, other_id;
  ELSE
    INSERT INTO profiles(id,display_name) VALUES(owner_id,'테스트 전승자'),(other_id,'다른 사용자');
  END IF;
  INSERT INTO recipes(id, transmitter_id, transcript) VALUES(recipe_id,owner_id,'원문을 보존한다');
  BEGIN
    PERFORM s04_append_message(other_id,recipe_id,'user','타인 요청',NULL,NULL);
    RAISE EXCEPTION 'TEST: 타인 쓰기를 허용함';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'S04_NOT_DRAFT' THEN RAISE; END IF;
  END;
  msg_id := s04_append_message(owner_id,recipe_id,'user','찻숟가락 반',NULL,NULL);
  BEGIN
    PERFORM s04_save_analysis(owner_id,recipe_id,analysis,NULL);
    RAISE EXCEPTION 'TEST: 오래된 분석을 허용함';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'S04_STALE_ANALYSIS' THEN RAISE; END IF;
  END;
  PERFORM s04_save_analysis(owner_id,recipe_id,analysis,msg_id);
  IF (SELECT transcript FROM recipes WHERE id=recipe_id) <> '원문을 보존한다' THEN RAISE EXCEPTION 'TEST: 원문 변경'; END IF;
  IF (SELECT ai_analysis->'must_keep' FROM transmission_cards WHERE transmission_cards.recipe_id=s04_interview.recipe_id) IS NULL THEN RAISE EXCEPTION 'TEST: 기존 카드 DTO 호환성 손실'; END IF;
  BEGIN
    PERFORM s04_publish(owner_id,recipe_id,analysis);
    RAISE EXCEPTION 'TEST: 확인 없이 발행 허용';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'S04_SENSORY_INSUFFICIENT' THEN RAISE; END IF;
  END;
  INSERT INTO sensory_cases(transmitter_id,recipe_id,message_id,expression,dimension,context,food_name,resolved_value,evidence,confidence)
    VALUES(owner_id,recipe_id,msg_id,'쪼매','salt_intensity','나물 간하기','나물무침','찻숟가락 반','찻숟가락 반',0.6);
  msg_id := s04_append_message(owner_id,recipe_id,'assistant','추가 질문',NULL,NULL);
  BEGIN
    PERFORM s04_publish(owner_id,recipe_id,analysis);
    RAISE EXCEPTION 'TEST: 새 대화 이후 오래된 분석으로 발행 허용';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'S04_STALE_ANALYSIS' THEN RAISE; END IF;
  END;
  PERFORM s04_save_analysis(owner_id,recipe_id,analysis,msg_id);
  IF has_table_privilege('authenticated','sensory_cases','SELECT') OR has_function_privilege('authenticated','s04_publish(uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'TEST: 일반 사용자 내부 접근 허용'; END IF;
  result := s04_publish(owner_id,recipe_id,analysis);
  IF result <> s04_publish(owner_id,recipe_id,analysis) THEN RAISE EXCEPTION 'TEST: 발행 멱등성 실패'; END IF;
  IF (SELECT visibility FROM recipes WHERE id=recipe_id) <> 'public' THEN RAISE EXCEPTION 'TEST: 공개 전환 실패'; END IF;
END;
$$;
ROLLBACK;
