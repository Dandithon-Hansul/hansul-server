-- 홈 피드 c3b51d2의 공통 DDL. profiles는 앞선 온보딩 마이그레이션에서 생성한다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE recipes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmitter_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  CHECK (status <> 'published' OR (title IS NOT NULL AND length(btrim(title)) > 0)),
  hero_image_url      TEXT,
  transmitter_quote   TEXT,
  cooking_time        INT CHECK (cooking_time > 0),
  difficulty          TEXT CHECK (difficulty IN ('쉬움', '보통', '어려움')),
  servings            INT CHECK (servings > 0),
  ingredients         JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps               JSONB NOT NULL DEFAULT '[]'::jsonb,
  like_count          INT NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  save_count          INT NOT NULL DEFAULT 0 CHECK (save_count >= 0),
  visibility          TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  version             INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  region              TEXT,
  region_code         TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  audio_url           TEXT,
  transcript          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transmission_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  ai_analysis         JSONB NOT NULL DEFAULT '{}'::jsonb,
  context_summary     TEXT,
  voice_message_url   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sensory_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID REFERENCES recipes(id) ON DELETE SET NULL,
  transmitter_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expression          TEXT NOT NULL,
  resolved_value      TEXT NOT NULL,
  embedding           vector(1536),
  confidence          REAL CHECK (confidence BETWEEN 0 AND 1),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transmitter_id, expression)
);

CREATE TABLE chat_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content             TEXT NOT NULL,
  image_url           TEXT,
  audio_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cooking_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  learner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluation          JSONB,
  ai_feedback         TEXT,
  photo_url           TEXT,
  cooked_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_saves (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saved_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, profile_id)
);

CREATE TABLE recipe_likes (
  recipe_id           UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, profile_id)
);

-- =====================================================================
-- 인덱스
-- =====================================================================

CREATE INDEX idx_recipes_transmitter ON recipes(transmitter_id);
CREATE INDEX idx_recipes_region ON recipes(region);
CREATE INDEX idx_recipes_popular ON recipes(like_count DESC, created_at DESC);
CREATE INDEX idx_chat_messages_recipe ON chat_messages(recipe_id, created_at);
CREATE INDEX idx_sensory_transmitter ON sensory_entries(transmitter_id, expression);
CREATE INDEX idx_cooking_sessions_learner ON cooking_sessions(learner_id, cooked_at DESC);
CREATE INDEX idx_recipe_saves_profile ON recipe_saves(profile_id, saved_at DESC);

CREATE INDEX idx_profiles_sensory_vector ON profiles
  USING ivfflat (sensory_vector vector_cosine_ops)
  WITH (lists = 10);

-- =====================================================================
-- Row-Level Security
-- 레시피·카드 조회는 서버 전용(service-role) 클라이언트에서 처리한다.
-- =====================================================================

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transmission_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON recipes, transmission_cards, chat_messages, recipe_likes, recipe_saves FROM PUBLIC, anon, authenticated;

CREATE POLICY public_recipe_read ON recipes
  FOR SELECT USING (status = 'published' AND visibility = 'public');

CREATE POLICY transmitter_manage_recipe ON recipes
  FOR ALL USING (transmitter_id = auth.uid())
  WITH CHECK (transmitter_id = auth.uid());

CREATE POLICY transmitter_manage_card ON transmission_cards
  FOR ALL USING (recipe_id IN (
    SELECT id FROM recipes WHERE transmitter_id = auth.uid()
  ));

CREATE POLICY own_sensory_entries ON sensory_entries
  FOR ALL USING (transmitter_id = auth.uid())
  WITH CHECK (transmitter_id = auth.uid());

CREATE POLICY recipe_chat_access ON chat_messages
  FOR ALL USING (recipe_id IN (
    SELECT id FROM recipes WHERE transmitter_id = auth.uid()
  ));

CREATE POLICY own_cooking_sessions ON cooking_sessions
  FOR ALL USING (learner_id = auth.uid())
  WITH CHECK (learner_id = auth.uid());

CREATE POLICY own_recipe_saves ON recipe_saves
  FOR ALL USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY own_recipe_likes ON recipe_likes
  FOR SELECT USING (profile_id = auth.uid());
