# 한술 — 지역 식문화 전승 서비스 · 백엔드

> 대구·경북의 향토음식과 가정에서 전해 내려오는 조리법을 AI 음성 대화로 기록하고,  
> 누구나 쉽게 찾아보고 따라 만들 수 있도록 돕는 지역 식문화 전승 서비스

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Storage%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://hansul-server.vercel.app)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97706?logo=anthropic&logoColor=white)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 배포 환경

| 환경 | URL |
|------|-----|
| Production | https://hansul-server.vercel.app |
| Dev (develop 브랜치) | https://hansul-server-git-develop-eunhyes-projects-0b70d4c2.vercel.app |
| Swagger UI | https://hansul-server.vercel.app/api-docs |

---

## 서비스 개요

대구·경북에는 지역 고유의 향토음식과 종가·노포에서 오랫동안 이어져 온 조리법이 있습니다. '쪼매', '적당히', '한 움큼'처럼 감각으로 전해지는 표현은 글로 옮기기 어렵고, 기록되지 않으면 사라질 수 있습니다.

**한술**은 AI 음성 대화로 조리법을 쉽게 기록하고, 대구·경북 지역의 손맛을 누구나 찾아 따라 만들 수 있도록 연결합니다.

### 핵심 기능

| 기능 | 설명 |
|------|------|
| 🎙️ **음성 레시피 기록** | 말하면 AI가 감각어를 탐지하고 추가 질문으로 구조화된 레시피를 완성 |
| 🤖 **AI 채팅 인터뷰** | 텍스트·음성·사진 복합 입력, 응답은 텍스트·TTS 동시 스트리밍 |
| 🗺️ **지역 레시피 지도** | 대구·경북 폴리곤 지도에서 지역 클릭 시 인기 레시피 바텀 시트 |
| 🧠 **손맛 프로파일** | 감각어 답변을 벡터화해 2회차부터 자동 반영, 불일치 시만 재질문 |
| 🖼️ **단계별 AI 이미지** | DALL-E 3로 중간 조리 단계 이미지 일괄 생성·재생성 |
| 👤 **전승자 프로필** | 아바타 업로드, 지역·음식 취향 설정, 전승 레시피 통계 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router + API Routes) |
| 언어 | TypeScript 5 |
| 데이터베이스 | Supabase PostgreSQL (pgvector 확장) |
| 인증 / 스토리지 | Supabase Auth, Supabase Storage |
| AI — 대화 · 분석 | Claude Sonnet 4.6 (Anthropic) |
| AI — STT | Web Speech API / OpenAI Whisper (fallback) |
| AI — 이미지 | OpenAI DALL-E 3 |
| AI — TTS | OpenAI tts-1 |
| 배포 | Vercel (GitHub 연동 자동 배포) |
| API 문서 | OpenAPI 3.1 · Swagger UI |

---

## 로컬 실행

**요구사항:** Node.js 20.9 이상, npm

```bash
# 의존성 설치
npm ci

# 환경변수 설정
cp .env.example .env.local
# .env.local에 팀 프로젝트 값 입력

# 개발 서버 실행 (포트 3000)
npm run dev
```

서버가 뜨면 아래에서 확인할 수 있습니다.

| 경로 | 내용 |
|------|------|
| `http://localhost:3000/api/health` | 서버 상태 확인 |
| `http://localhost:3000/api-docs` | Swagger UI |

### 정적 검사 / 빌드

```bash
npm run lint
npm run typecheck
npm run build
```

---

## 환경변수

`.env.example`을 참고해 `.env.local`을 작성합니다.

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `ANTHROPIC_MODEL` | 사용할 Claude 모델 (기본: `claude-sonnet-4-6`) |
| `OPENAI_API_KEY` | Whisper · DALL-E 3 · TTS 키 |
| `STT_MODEL` | STT 모델 (기본: `whisper-1`) |
| `TTS_MODEL` | TTS 모델 (기본: `tts-1`) |
| `IMAGE_MODEL` | 이미지 생성 모델 |
| `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | Kakao Maps JavaScript SDK 키 |

---

## 프로젝트 구조

```
hansul-server/
├── src/
│   ├── app/
│   │   ├── api/          # API Routes
│   │   └── api-docs/     # Swagger UI 페이지
│   └── lib/
│       ├── auth.ts       # 인증 헬퍼
│       ├── openapi.ts    # OpenAPI 3.1 스펙 정의
│       ├── profiles/     # 프로필 로직
│       ├── recipes/      # 레시피 로직
│       ├── uploads/      # 업로드 서명
│       ├── supabase/     # Supabase 클라이언트
│       └── map/          # 지역 데이터
├── supabase/
│   ├── migrations/       # DB 마이그레이션
│   └── seed.sql          # 데모 시드 데이터
└── docs/
    ├── API 명세서.md
    ├── ERD.md
    ├── 시스템 아키텍처.md
    └── decisions/        # ADR (Architecture Decision Records)
```

---

## 개발 워크플로우

```
feature/* or fix/*
        ↓ PR + self-review
     develop
        ↓ 회의 승인 후 병합
       main
```

- 기능·버그 수정은 `develop` 대상 PR로 작업합니다.
- `develop → main` 승격은 팀 회의에서 포함 기능·위험·롤백 방법을 확인 후 진행합니다.

---

## 문서

| 문서 | 경로 |
|------|------|
| API 명세서 | `docs/API 명세서.md` |
| ERD | `docs/ERD.md` |
| 시스템 아키텍처 | `docs/시스템 아키텍처.md` |
| ADR | `docs/decisions/` |
