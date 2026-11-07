-- Replace the demo account UUID below with a test Auth user's ID before running.
DO $$
DECLARE
  author_id uuid := '22222222-2222-4222-8222-222222222222';
  demo_id uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = author_id) THEN
    RAISE EXCEPTION 'Set author_id to an existing test Auth user ID';
  END IF;
  INSERT INTO public.profiles (id, role, display_name, region, region_code, bio)
  VALUES (author_id, 'transmitter', '한술 시드 전승자', '안동시', '47170', '안동 가정식 레시피를 기록합니다.')
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = author_id AND role = 'transmitter') THEN
    RAISE EXCEPTION 'Use a test transmitter account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.recipes WHERE id = demo_id AND transmitter_id <> author_id) THEN
    RAISE EXCEPTION 'The demo recipe ID belongs to another author';
  END IF;

  INSERT INTO public.recipes (
    id, transmitter_id, title, region, region_code, transmitter_quote, cooking_time,
    difficulty, servings, status, visibility, ingredients, steps
  ) VALUES (
    demo_id, author_id, '안동찜닭', '안동시', '47170',
    '당면은 국물이 자작해질 때 넣어야 양념이 잘 배어요.',
    45, '보통', 3, 'published', 'public',
    '[{"name":"닭","amount":900,"unit":"g"},{"name":"감자","amount":2,"unit":"개"},{"name":"간장","amount":5,"unit":"큰술"},{"name":"당면","amount":100,"unit":"g","note":"미리 불려 두기"}]',
    '[{"order":1,"title":"재료 손질하기","description":"닭과 감자를 손질하고 당면을 불립니다.","tip":"감자는 너무 작게 자르지 마세요.","is_key_step":false},{"order":2,"title":"닭과 감자 조리기","description":"간장 양념에 닭과 감자를 넣고 조립니다.","tip":"국물이 자작해질 때까지 조립니다.","is_key_step":true},{"order":3,"title":"당면 넣고 마무리하기","description":"불린 당면을 넣고 익힌 뒤 그릇에 담습니다.","is_key_step":false}]'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.transmission_cards (recipe_id, context_summary)
  VALUES (demo_id, '가족이 모이는 날 함께 먹는 안동찜닭입니다.')
  ON CONFLICT (recipe_id) DO NOTHING;
END;
$$;
