# hansul-server
한술 프로젝트 백엔드 서버입니다.

## 로컬 실행

Node.js 20.9 이상과 npm이 필요합니다.

```powershell
npm ci
npm run dev
```

http://localhost:3000 과 /api/health에서 실행을 확인할 수 있습니다.
서비스 연동 시 .env.example을 .env.local로 복사해 팀 프로젝트 값을 입력합니다.

```powershell
npm run lint
npm run build
npm run typecheck
```

API 계약, ERD, 시스템 아키텍처는 docs 폴더에 있습니다.

## S-05·S-06 상세 API 로컬 시드

PowerShell에서 아래처럼 로컬 서버를 실행하면 Supabase 키 없이 공개 데모 레시피 한 건을 확인할 수 있습니다.

```powershell
$env:RECIPE_DETAIL_SEED_MODE = "true"
npm run dev
```

`GET /api/recipes/11111111-1111-4111-8111-111111111111`는 안동찜닭과 조리 단계 3개를 반환합니다. 시드에 이미지와 음성은 없어 URL은 null입니다. 일반 조회는 Supabase 스키마와 서버 키를 설정하고 Bearer 토큰을 보내야 합니다.

### 실제 Supabase로 S-05·S-06 검증

빈 Supabase 프로젝트에는 supabase/migrations의 초기 SQL을 적용합니다. 기존 테이블이 있는 공유 프로젝트는 ERD와 실제 스키마를 대조한 후 적용하세요. supabase/examples/recipe_detail_seed.sql의 author_id에 테스트 전승자 Auth UUID를 넣어 실행합니다. 테스트 학습자 계정에도 profiles 행이 필요합니다.

- 상세: GET /api/recipes/:id
- 좋아요: POST /api/recipes/:id/like
- 저장: POST /api/recipes/:id/save
- 작성자 프로필: GET /api/profiles/:id

각 요청에 Authorization: Bearer <access_token>을 보냅니다. 토글은 동일 요청을 재전송하면 이전 상태로 돌아갑니다. 쓰기 검증에는 실제 인증 토큰과 Supabase가 필요합니다.

비공개 미디어는 버킷 recipe-images, card-voice, step-images, step-photos 아래의 {transmitter_id}/{recipe_id}/ 경로를 사용합니다. DB에는 객체 경로를 저장하면 상세 요청에서 10분 서명 URL을 발급합니다. S-06은 steps 배열과 order로 진행하고 마지막 단계에서 화면의 조리 흐름을 종료합니다.
