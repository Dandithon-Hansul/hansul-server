CREATE UNIQUE INDEX idx_recipes_id_transmitter ON recipes(id, transmitter_id);

CREATE TABLE upload_grants (
  path TEXT PRIMARY KEY,
  bucket TEXT NOT NULL CHECK (bucket = 'uploads'),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID,
  purpose TEXT NOT NULL CHECK (purpose IN ('stt_audio', 'card_voice', 'chat_image')),
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (recipe_id, owner_id) REFERENCES recipes(id, transmitter_id) ON DELETE CASCADE,
  CHECK (purpose = 'stt_audio' OR recipe_id IS NOT NULL),
  CHECK (
    (purpose = 'stt_audio' AND size_bytes <= 26214400 AND content_type IN ('audio/webm','audio/mp4','audio/wav')) OR
    (purpose = 'card_voice' AND size_bytes <= 5242880 AND content_type IN ('audio/webm','audio/mp4','audio/wav')) OR
    (purpose = 'chat_image' AND size_bytes <= 10485760 AND content_type IN ('image/jpeg','image/png','image/webp'))
  ),
  CHECK (starts_with(path, owner_id::text || '/' || purpose || '/'))
);
ALTER TABLE upload_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON upload_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON upload_grants TO service_role;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES('uploads', 'uploads', false, 26214400, ARRAY['audio/webm','audio/mp4','audio/wav','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
