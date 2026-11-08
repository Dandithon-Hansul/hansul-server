> 복구 기록: 이전 세션의 설계 초안을 복원했다. 승인 기록은 Issue #8과 PR #9 및 세션에 있으며, 아래의 초기 상태·전제는 현재 저장소와 다를 수 있다.

# S-04 채팅 백엔드 설계

작성일: 2026-11-08 · 상태: 승인 대기 · 브랜치: (승인 후) `feature/chat`

## 1. 의도와 배경

S-04 "채팅"은 전승자가 S-03에서 음성 녹음을 마친 뒤, AI와 멀티턴 대화로 감각어("쪼매", "자작하게")를 **확인**하며 구전 레시피를 구조화·확정하는 화면이다. `hansul-server`는 Next.js 16 App Router 백엔드이므로 "S-04를 만든다"는 이 화면을 받치는 **라우트 핸들러 3개와 그 하부 구조**를 구현하는 것을 뜻한다.

핵심 제품 원칙(시스템 프롬프트 §1, 아키텍처 §9): **AI는 감각어를 추정해 확정하지 않는다.** 확인되지 않은 값은 `unresolved`로 남기고, 선택지 + 자유 텍스트로 전승자에게 되묻는다. 손맛의 본질은 개인 감각이며 AI 추정은 전승을 왜곡하기 때문이다.

## 2. 범위

**Goals**
- `POST /api/analyze` — transcript 구조화 + 감각어 탐지 + 감각 사전 재활용(auto_applied) + 질문 생성.
- `POST /api/chat` — 멀티턴 답변 처리, Claude 응답 SSE 텍스트 스트리밍 + OpenAI TTS 오디오 병렬 스트리밍, `chat_messages` 저장.
- `POST /api/recipes` — 초안 검증 후 발행(status=published, visibility=public).
- 위 3개가 **실 Claude·OpenAI·Supabase(pgvector)** 와 end-to-end로 동작.

**Non-goals (이번 범위 아님)**
- S-03 `/api/stt`(실 Whisper 녹음→transcript). 단, analyze 검증을 위해 **초안+transcript 시드 수단**은 최소로 포함한다(§8).
- 정식 Supabase Auth 로그인/온보딩(S-01). 개발용 인증 스텁으로 대체(§7).
- 프런트엔드 화면, 지도(S-07), 단계 이미지 생성.

**Anti-goals (해도 실패로 간주)**
- AI가 확인 없이 감각어 수치를 확정해 저장하는 것.
- 공개 응답에 `transcript`·`ai_analysis`·원본 음성 URL 등 내부 인터뷰 데이터가 노출되는 것(API 명세서 §5).
- 요청 범위를 넘는 추상화·설정 가능성·방어 코드.

## 3. 확정된 결정 (브레인스토밍)

1. 범위: analyze + chat + 발행.
2. AI: 실 Claude Sonnet 4.6 + OpenAI `tts-1` 동시 스트리밍.
3. 감각 사전: pgvector 임베딩 유사도 재활용(`text-embedding-3-small`, 1536차원).
4. 인프라: 아직 provision 안 됨 → 셋업 단계 포함, 키·자격증명은 사용자가 주입. 그 전까지 검증은 어댑터/fake 경계로.
5. 인증: 개발용 스텁 먼저. 정식 Supabase Auth는 후속.
6. 워크플로우: 프로젝트 AGENTS.md 준수 — develop → `feature/chat` → Issue → Draft PR → TDD → `/self-review` → 사용자 병합.

## 4. 전제와 선행 의존성

- **DB**: ERD DDL(§ERD.md) 미적용. `supabase/migrations/`에 스키마 + `vector` 확장 + RLS 정책을 만든다.
- **인증 코드 없음**: RLS가 `auth.uid()` 기반. 개발 스텁으로 고정 사용자 컨텍스트를 주입한다.
- **테스트 러너 없음**: `package.json`에 lint·typecheck만 존재. TDD를 위해 **Vitest**를 추가한다(내 결정, §12).
- **키 주입은 사용자**: `.env`는 비어 있음. 사용자가 Supabase/Anthropic/OpenAI 키를 `.env`에 주입하면 실 연동 검증을 수행한다. 키가 없는 동안 TDD는 fake 어댑터로 green, 실 연동은 수동 검증 체크리스트로 분리(아키텍처 리스크 §"데모용 mock 모드 분리"와 정합).

## 5. 아키텍처

아키텍처 문서 §5의 레이어 구조(route → service → adapter/repository)를 따른다. 라우트는 얇게, 로직은 서비스에, 외부 I/O는 어댑터 뒤에 둔다.

```
src/
  app/api/
    analyze/route.ts        # POST  얇은 핸들러: zod 검증 → auth → service → JSON
    chat/route.ts           # POST  SSE 스트리밍 핸들러
    recipes/route.ts        # POST  발행 핸들러
  lib/
    auth/resolve-user.ts    # 개발 스텁(헤더/env 고정 사용자) ↔ 후속 Supabase Auth 교체 지점
    ai/
      interview-prompt.ts   # 인터뷰 시스템 프롬프트 상수(인터뷰_AI_시스템_프롬프트 전문)
      claude.ts             # Claude 어댑터(port + 실 구현): analyze JSON / chat 스트림
      tts.ts                # OpenAI tts-1 어댑터(문장→mp3)
      embedding.ts          # text-embedding-3-small 어댑터
    services/
      analyze.ts            # 구조화·감각어·auto_applied·질문 오케스트레이션
      chat.ts               # 멀티턴·스트림·TTS·메시지 저장 오케스트레이션
      publish.ts            # 초안 검증·발행
      sensory.ts            # 감각 사전 조회/재활용(pgvector) + 벡터화 저장
    db/
      recipes.ts chat-messages.ts sensory-entries.ts transmission-cards.ts
    sse.ts                  # SSE 이벤트 포매팅 유틸
    supabase/server.ts      # (기존) 서버 클라이언트
supabase/migrations/        # ERD DDL + RLS + pgvector
```

**port 경계**: `ClaudePort`, `TtsPort`, `EmbeddingPort`, 그리고 DB 리포지토리 인터페이스. 서비스는 port에만 의존 → 단위 테스트는 fake port 주입으로 결정적. 라우트에서 실 구현을 주입한다.

## 6. 엔드포인트 설계

계약은 `docs/API 명세서.md`(BE 확정본)를 **그대로** 따른다. 아래는 동작 명세.

### 6.1 `POST /api/analyze`
- 입력: `{ recipe_id }`. auth로 소유 초안 확인(RLS).
- `recipes.transcript` 로드 → 전승자 `sensory_entries`를 임베딩 유사도로 조회 → 같은 음식/조리 문맥의 확정 표현은 `auto_applied`.
- Claude(인터뷰 프롬프트, JSON 전용 출력 §9)에 transcript + auto_applied + ASR 불확실 구간 전달 → `structured`/`detected_sensory_terms`/`questions`/`card` 산출.
- `transmission_cards.ai_analysis`(must_keep/can_change/unresolved/context)와 구조화 결과를 초안에 저장.
- 응답: `{ structured, questions, auto_applied }`(명세서 §3 형태). 질문은 선택지 2~4개 + 자유 텍스트 + priority(P0 즉시질문/나머지 pending).

### 6.2 `POST /api/chat`
- 입력: `{ recipe_id, message, image_path?, tts? }`(tts 기본 false). 이미지 10MB 초과 → 413, `recipe_id` 없음 → 422.
- 사용자 메시지를 `chat_messages`(role=user) 저장. 히스토리 + transcript + 시스템 프롬프트로 Claude 멀티턴 호출.
- **스트리밍**: `text/event-stream`. `event: chunk`(텍스트 조각) 연속 → `tts=true`면 문장 경계마다 `tts-1`로 mp3 생성·Supabase Storage(`tts/{transmitter_id}/{recipe_id}/{message_id}.mp3`) 업로드 후 signed URL을 `event: audio`로. 종료 시 assistant 메시지 저장 후 `event: done {message_id, audio_url}`.
- 텍스트와 오디오 이벤트는 독립 → FE가 표시·재생을 겹쳐 수행.

### 6.3 `POST /api/recipes` (발행)
- 입력: `{ recipe_id }`. 소유·초안 검증. **확정 감각 항목 1개 이상** 아니면 422 `SENSORY_INSUFFICIENT`.
- 제목·재료·단계 확정, `status=published`, `visibility=public`로 전환. `context_summary` 생성.
- 멱등: 같은 `recipe_id` 재호출 시 기존 발행 결과 반환.
- 응답: `{ recipe_id, status, context_summary, voice_message_url }`.

## 7. 개발용 인증 스텁

- `resolveUser(req)`: 개발 모드에서 `X-Dev-User` 헤더 또는 `DEV_USER_ID` env의 고정 UUID를 사용자로 반환. Supabase 접근은 해당 사용자 JWT를 흉내 내거나 service-role + 명시적 `transmitter_id` 필터로 수행.
- 모든 라우트는 이 함수로만 사용자 식별 → 후속에 Supabase Auth JWT 검증으로 **한 파일만** 교체.
- 테스트/시드용 고정 사용자를 마이그레이션 시드에 1명 생성.

## 8. 초안+transcript 시드 (S-03 경계 대체)

analyze가 돌려면 `recipes`(draft) + `transcript`가 필요하다. S-03는 범위 밖이므로:
- 테스트: fixture로 draft+transcript 삽입.
- 수동 검증: 개발 전용 시드 스크립트(또는 `DEV` 가드가 걸린 얇은 엔드포인트)로 샘플 transcript 초안 생성. S-03 구현 시 `/api/stt`로 교체되는 임시 seam임을 주석·문서에 명시.

## 9. 감각 사전 / pgvector 재활용

- `sensory_entries(transmitter_id, expression, resolved_value, embedding vector(1536), confidence, UNIQUE(transmitter_id, expression))`. `profiles.sensory_vector`와 `idx_profiles_sensory_vector`(ivfflat cosine)는 ERD대로.
- 재활용(시스템 프롬프트 §5): ① 표현+dimension으로 먼저 검색 → ② 같은 음식/조리 문맥이면 `auto_applied` → ③ 같은 표현이라도 재료량·냄비·조리법 다르면 재질문 → ④ 값 충돌/범위 밖이면 그 항목만 재질문 → ⑤ 새 답변은 덮어쓰지 않고 사례로 축적, ⑥ 2회 이상 일관 확인 시 confidence 상향.
- 유사도 임계값은 구현 중 fixture로 보정(초기값 cosine ≥ 0.85 가정, 측정 후 조정). `/api/sensory/vectorize`로 임베딩 생성·저장.

## 10. AI 어댑터와 프롬프트

- 시스템 프롬프트는 `인터뷰_AI_시스템_프롬프트.pdf` 전문을 `interview-prompt.ts` 상수로. analyze는 "설명문 없이 JSON만"(§9) 출력, chat은 자연스러운 한국어 1~2문장(§9) 출력 두 모드.
- Claude 어댑터는 `@anthropic-ai/sdk`, 모델은 `ANTHROPIC_MODEL`(claude-sonnet-4-6). JSON 모드는 응답을 zod 스키마로 파싱·검증(실패 시 1회 재시도).
- latency 8초+ 리스크: chat은 스트리밍으로 흡수. analyze는 로딩 상태 전제(FE). 키 부재 시 fake 어댑터.

## 11. DB 마이그레이션

`supabase/migrations/0001_init.sql`: ERD §2 DDL 전체(profiles~recipe_saves) + `CREATE EXTENSION vector` + §4 인덱스 + §5 RLS 정책/REVOKE. 시드: 고정 개발 사용자 1명. 적용은 Supabase CLI 또는 대시보드(사용자 주입 키 환경에서).

## 12. 테스트 전략 (TDD)

- 러너: **Vitest**(경량, TS/ESM, Next 무관 유닛). `test` 스크립트 추가.
- TDD 대상(결정적, fake port): 프롬프트 빌드, analyze 산출 매핑, 감각 사전 매칭/임계값 분기, SSE 이벤트 프레이밍, chat 메시지 저장 순서, 발행 검증(SENSORY_INSUFFICIENT·멱등), DTO에서 내부 필드 제외.
- 실 연동(키 주입 후 수동, PR에 결과 기록): analyze 실 Claude JSON 1건, chat 실 스트림+TTS 1건, 발행 1건. 키 없으면 "미실행 사유+위험"으로 PR에 명시.
- 버그 수정 시 회귀 테스트 선작성.

## 13. ADR 후보 (구현 전 docs/decisions/에 기록)

- `NNN-s04-ai-adapter-boundary` — port/어댑터 경계 + Claude JSON·스트림 패턴, fake 분리.
- `NNN-dev-auth-stub` — 개발용 인증 스텁과 Supabase Auth 교체 경로.
- `NNN-test-framework-vitest` — 테스트 러너 선택(경량 1건).

## 14. 작업 순서 (독립 검증 단위)

1. `feature/chat` 브랜치 + Issue + Draft PR -> verify: 브랜치/PR 생성, Draft 상태.
2. 마이그레이션(ERD+RLS+pgvector)+시드 사용자 작성 -> verify: 로컬/Supabase 적용, 테이블·정책 존재.
3. Vitest 도입 + 인증 스텁 + port 인터페이스 + fake 어댑터 -> verify: `npm test` 통과(빈 스위트→첫 테스트), typecheck.
4. 감각 사전 서비스(조회/매칭/vectorize) TDD -> verify: 매칭·임계값·축적 단위 테스트 green.
5. `/api/analyze` 서비스+라우트 TDD -> verify: 구조화·질문·auto_applied·내부필드 제외 테스트 green.
6. `/api/chat` 서비스+SSE 라우트+TTS TDD -> verify: 이벤트 프레이밍·메시지 저장·tts 분기 테스트 green.
7. `/api/recipes` 발행 TDD -> verify: 검증·422·멱등 테스트 green.
8. 실 연동 수동 검증(키 주입 시) + ADR 기록 -> verify: analyze/chat/발행 실제 1회씩, 결과 PR 기록.
9. `/self-review` -> verify: ✅ 통과 후 사용자에게 병합 요청.

## 15. 리스크와 빌더에게 남기는 선택

- **키 미주입 시** 8단계 실 연동 검증 불가 → PR에 "미실행+위험"으로 남기고 fake 기반 green까지만 완료로 본다.
- **pgvector 임계값**은 데이터 부족으로 초기 추정 → fixture/실측으로 보정(빌더 판단).
- **초안 시드 seam**은 S-03 전까지 임시 → S-03 구현 시 제거.
- Claude JSON 스키마가 프롬프트 §9와 미세하게 어긋나면 zod 스키마를 프롬프트 기준으로 맞춘다(빌더 판단).


## 2026-11-08 후속 구현 상태

사용자가 제공한 인터뷰 프롬프트 전문을 src/lib/ai/interview-prompt.ts에 보존했다. 원문과 저장된 문자열의 SHA-256 일치를 확인하고 회귀 테스트로 고정했다.

구현한 경로는 POST /api/analyze, POST /api/chat, POST /api/recipes다. 분석은 전체 인터뷰 결과를 내부에 보존하며 공개 응답은 별도 DTO로 제한한다. 채팅은 텍스트·문장별 TTS SSE, 답변 근거가 있는 문맥별 감각 사례 축적, 대화 후 재분석을 포함한다. 발행은 소유자·확정 사례·구조화·P0 불확실성을 검사하고 DB에서 멱등 처리한다.

검증 결과: Vitest 47개, 타입 검사, 린트, Next.js 운영 빌드 통과. PGlite + pgvector의 폐기 가능한 로컬 DB에서 공통 기본 스키마와 S-04 마이그레이션을 실제 실행했다. supabase/tests/s04_interview.sql은 타인 접근 거부, 오래된 분석 거부, 원문 보존, 기존 카드 필드 호환, 미확정 발행 거부, 새 메시지 이후 재분석 요구, 발행 멱등과 공개 전환, 일반 사용자 권한 차단을 검증한다. auth/storage는 최소 스키마로 대체했으므로 실제 Supabase Storage·PostgREST·RLS 배포 검증을 대신하지 않는다.

아직 완료되지 않은 항목:
- POST /api/sensory/vectorize 응답의 dimensions 척도와 null 허용 여부는 사용자 확인 대기다. 임의 숫자나 confidence를 맛 강도로 내보내지 않는다.
- 원격 Supabase 마이그레이션 적용과 실제 Claude/OpenAI/Storage 연동은 필수 환경변수 미설정으로 실행하지 않았다.
- 기본 테이블·vector 확장은 다른 기능 브랜치의 공통 마이그레이션 병합에 의존한다. 온보딩 role 제거 결정과의 통합 순서를 확인해야 한다.
- 이미지 소유자 경로·객체 크기·형식·레시피 소유권을 검증한다. 업로드 발급 기록과 해당 레시피의 연결을 검증하는 공통 계약은 현재 S-03 업로드 코드에 없으므로 팀 통합 시 추가해야 한다.
- PR #9는 Draft 상태를 유지한다. 검증 결과를 PR 본문에 게시하거나 Ready로 바꾸는 작업은 아직 하지 않았다.

로컬 테스트 도구에서 발견된 취약점은 Vitest 4.1.12 갱신으로 critical 0개가 됐다. 남은 audit 항목은 moderate 8개이며 이번 작업에서 무관한 의존성을 강제 갱신하지 않았다.
