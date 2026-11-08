-- seed.sql
-- 한술 데모 시드: 공개 레시피 6개 + 전승자 2명 + 데모 뷰어 1명 + 좋아요/저장 관계
-- 주의: profiles.id는 auth.users(id)를 참조하므로 데모용 auth.users를 먼저 생성한다.
--       Supabase 버전에 따라 auth.users 컬럼이 다를 수 있으니, 대시보드에서 생성한
--       사용자로 대체하려면 아래 UUID만 바꿔 사용한다.

-- =====================================================================
-- 데모 auth.users (비밀번호 로그인 없이 식별자 용도)
-- =====================================================================
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'viewer@hansul.demo',  crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'younghee@hansul.demo', crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'soonja@hansul.demo',  crypt('demo-password', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- profiles
--   viewer: 데모 로그인 사용자(학습자), 안동시 거주 → 추천 지역 매칭 대상
-- =====================================================================
INSERT INTO profiles (id, display_name, region, region_code, food_preferences)
VALUES
  ('11111111-1111-1111-1111-111111111111', '김한솔', '안동시',        '47170', '["탕·찌개", "구이", "찜·조림"]'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '김영희', '안동시 정하동', '47170', '[]'::jsonb),
  ('33333333-3333-3333-3333-333333333333', '박순자', '대구 중구',     '27110', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- recipes (모두 published + public)
--   like_count/save_count는 데모 노출용 집계값
-- =====================================================================
INSERT INTO recipes (id, transmitter_id, title, status, visibility, hero_image_url, transmitter_quote, cooking_time, difficulty, servings, region, region_code, like_count, save_count, created_at)
VALUES
  ('a0000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '안동 찜닭',       'published', 'public', 'https://picsum.photos/seed/jjimdak/800',  '간장은 한 번에 붓지 말고 나눠 넣어요.', 60, '보통', 4, '안동시 정하동', '47170', 162, 102, now() - interval '1 day'),
  ('a0000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '안동 식혜',       'published', 'public', 'https://picsum.photos/seed/sikhye/800',   '엿기름 물은 꼭 가라앉혀 윗물만 쓰세요.', 120, '어려움', 6, '안동시', '47170', 102, 99, now() - interval '2 day'),
  ('a0000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '안동 간고등어 조림', 'published', 'public', 'https://picsum.photos/seed/godeungeo/800', '무를 아래 깔아야 비린내가 잡혀요.', 40, '쉬움', 3, '안동시', '47170', 97, 97, now() - interval '3 day'),
  ('a0000004-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', '대구탕',          'published', 'public', 'https://picsum.photos/seed/daegutang/800', '대파는 마지막에 넣어 향을 살려요.', 35, '보통', 4, '대구 중구', '27110', 80, 60, now() - interval '4 day'),
  ('a0000005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', '대구 뭉티기',     'published', 'public', 'https://picsum.photos/seed/mungtigi/800', '칼이 아니라 결을 따라 손으로 떼요.', 20, '쉬움', 2, '대구 중구', '27110', 62, 65, now() - interval '5 day'),
  ('a0000006-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', '경주 쌈밥',       'published', 'public', 'https://picsum.photos/seed/ssambap/800',  '된장은 짜지 않게 멸치로 감칠맛을 더해요.', 30, '쉬움', 4, '경주시', '47130', 55, 40, now() - interval '6 day')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 데모 뷰어의 좋아요/저장 (is_liked / is_saved 검증용)
-- =====================================================================
INSERT INTO recipe_saves (recipe_id, profile_id)
VALUES ('a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (recipe_id, profile_id) DO NOTHING;

INSERT INTO recipe_likes (recipe_id, profile_id)
VALUES ('a0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (recipe_id, profile_id) DO NOTHING;
