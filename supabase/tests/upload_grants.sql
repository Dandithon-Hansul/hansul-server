BEGIN;
DO $$
DECLARE
  owner_id UUID := '10000000-0000-4000-8000-000000000011';
  other_id UUID := '10000000-0000-4000-8000-000000000012';
  own_recipe UUID := '20000000-0000-4000-8000-000000000011';
  other_recipe UUID := '20000000-0000-4000-8000-000000000012';
  path_prefix TEXT;
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') THEN RAISE EXCEPTION 'TEST: 통합 프로필은 role 없는 스키마여야 함'; END IF;
  INSERT INTO auth.users(id) VALUES(owner_id),(other_id);
  INSERT INTO profiles(id,display_name) VALUES(owner_id,'전승자'),(other_id,'다른 전승자');
  INSERT INTO recipes(id,transmitter_id) VALUES(own_recipe,owner_id),(other_recipe,other_id);
  path_prefix := owner_id::text || '/chat_image/';
  INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
    VALUES(path_prefix || 'valid.png','uploads',owner_id,own_recipe,'chat_image','image/png',100);
  BEGIN
    INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
      VALUES(path_prefix || 'wrong-owner.png','uploads',owner_id,other_recipe,'chat_image','image/png',100);
    RAISE EXCEPTION 'TEST: 타인의 레시피에 발급 기록을 저장함';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
      VALUES(path_prefix || 'no-recipe.png','uploads',owner_id,NULL,'chat_image','image/png',100);
    RAISE EXCEPTION 'TEST: 채팅 이미지의 대상 레시피 누락 허용';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
      VALUES(path_prefix || 'oversized.png','uploads',owner_id,own_recipe,'chat_image','image/png',10485761);
    RAISE EXCEPTION 'TEST: 크기 초과 기록 허용';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
      VALUES(path_prefix || 'wrong-type.png','uploads',owner_id,own_recipe,'chat_image','audio/webm',100);
    RAISE EXCEPTION 'TEST: 용도와 다른 형식 허용';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
      VALUES(owner_id::text || '/chatXimage/wrong-prefix.png','uploads',owner_id,own_recipe,'chat_image','image/png',100);
    RAISE EXCEPTION 'TEST: 다른 용도 경로의 발급 기록 허용';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO upload_grants(path,bucket,owner_id,recipe_id,purpose,content_type,size_bytes)
    VALUES(owner_id::text || '/stt_audio/first.webm','uploads',owner_id,NULL,'stt_audio','audio/webm',100);
  IF has_table_privilege('authenticated','upload_grants','SELECT') OR has_table_privilege('authenticated','upload_grants','INSERT') OR has_table_privilege('anon','upload_grants','SELECT') THEN RAISE EXCEPTION 'TEST: 발급 기록 일반 접근 허용'; END IF;
  IF NOT has_table_privilege('service_role','upload_grants','INSERT') THEN RAISE EXCEPTION 'TEST: 서버 발급 기록 저장 권한 누락'; END IF;
  IF (SELECT public FROM storage.buckets WHERE id='uploads') IS DISTINCT FROM false THEN RAISE EXCEPTION 'TEST: uploads 버킷이 비공개가 아님'; END IF;
END;
$$;
ROLLBACK;
