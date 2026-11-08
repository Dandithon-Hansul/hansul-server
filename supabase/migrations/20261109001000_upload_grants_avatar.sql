-- upload_grants 테이블의 CHECK 제약 조건에 avatar purpose 추가
-- feat: 프로필 아바타 업로드(bdfdcf0)에서 코드만 추가되고 DB 마이그레이션이 누락됨

ALTER TABLE upload_grants
  DROP CONSTRAINT IF EXISTS upload_grants_purpose_check;

ALTER TABLE upload_grants
  ADD CONSTRAINT upload_grants_purpose_check
  CHECK (purpose IN ('stt_audio', 'card_voice', 'chat_image', 'avatar'));

-- upload_grants_check: stt_audio 또는 avatar는 recipe_id 불필요
ALTER TABLE upload_grants
  DROP CONSTRAINT IF EXISTS upload_grants_check;

ALTER TABLE upload_grants
  ADD CONSTRAINT upload_grants_check
  CHECK (purpose IN ('stt_audio', 'avatar') OR recipe_id IS NOT NULL);

-- upload_grants_check1: 파일 크기/타입 조건에 avatar 추가
ALTER TABLE upload_grants
  DROP CONSTRAINT IF EXISTS upload_grants_check1;

ALTER TABLE upload_grants
  ADD CONSTRAINT upload_grants_check1
  CHECK (
    (purpose = 'stt_audio'  AND size_bytes <= 26214400 AND content_type IN ('audio/webm','audio/mp4','audio/wav')) OR
    (purpose = 'card_voice' AND size_bytes <= 5242880  AND content_type IN ('audio/webm','audio/mp4','audio/wav')) OR
    (purpose = 'chat_image' AND size_bytes <= 10485760 AND content_type IN ('image/jpeg','image/png','image/webp')) OR
    (purpose = 'avatar'     AND size_bytes <= 5242880  AND content_type IN ('image/jpeg','image/png','image/webp'))
  );
