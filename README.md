<div align="center">

# 🍚 한술

**대구·경북 지역 식문화 전승 서비스 · 백엔드**

> *'쪼매', '적당히', '한 움큼'*  
> 감각으로만 전해지는 손맛을 AI가 기록합니다.

<br>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%C2%B7%20Auth%20%C2%B7%20Storage-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel)](https://hansul-server.vercel.app)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97706?style=flat-square&logo=anthropic&logoColor=white)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

<br>

[🌐 Production](https://hansul-server.vercel.app) &nbsp;·&nbsp;
[🔧 Dev](https://hansul-server-git-develop-eunhyes-projects-0b70d4c2.vercel.app) &nbsp;·&nbsp;
[📄 API Docs](https://hansul-server.vercel.app/api-docs)

</div>

<br>

---

## 목차

- [서비스 개요](#-서비스-개요)
- [기술 스택](#️-기술-스택)
- [로컬 실행](#-로컬-실행)
- [환경변수](#️-환경변수)
- [프로젝트 구조](#-프로젝트-구조)

---

## 📖 서비스 개요

대구·경북에는 지역 고유의 향토음식과 종가·노포에서 오랫동안 이어져 온 조리법이 있습니다. '쪼매', '적당히', '한 움큼'처럼 감각으로 전해지는 표현은 글로 옮기기 어렵고, 기록되지 않으면 사라질 수 있습니다.

**한술**은 AI 음성 대화로 조리법을 쉽게 기록하고, 대구·경북 지역의 손맛을 누구나 찾아 따라 만들 수 있도록 연결합니다.

<br>

### ✨ 핵심 기능

#### 🎙️ 음성 레시피 기록

말로 조리법을 설명하면, AI가 '쪼매', '적당히', '한 움큼'처럼 감각으로 표현된 말을 감지해 "양파 반 개 분량인가요?" 같은 추가 질문을 이어갑니다. 대화가 끝나면 재료·분량·순서가 정리된 구조화된 레시피가 완성됩니다.

#### 🤖 AI 채팅 인터뷰

텍스트, 음성 녹음, 사진을 함께 사용할 수 있는 복합 입력 방식의 인터뷰입니다. AI 응답은 텍스트와 음성(TTS)으로 동시에 스트리밍되어, 화면을 보거나 소리로 들으며 대화하듯 기록할 수 있습니다.

#### 🗺️ 지역 레시피 지도

대구·경북 지역을 폴리곤으로 그린 지도에서 원하는 지역을 클릭하면 그 동네의 인기 레시피 목록이 바텀 시트로 펼쳐집니다. 지역별 향토음식을 지도 위에서 직관적으로 탐색할 수 있습니다.

#### 🧠 손맛 프로파일

기록할 때마다 감각어 답변을 벡터로 저장해 나만의 손맛 프로파일을 만들어 갑니다. 2회차 기록부터는 이전 답변을 자동으로 반영하고, 이전과 다른 표현이 나왔을 때만 다시 물어보므로 반복 질문이 줄어듭니다.

#### 🖼️ 단계별 AI 이미지

레시피의 중간 조리 단계마다 DALL-E 3로 이미지를 자동 생성합니다. 완성본이 마음에 들지 않으면 개별 단계 이미지를 재생성할 수 있어, 완성도 높은 레시피 카드를 만들 수 있습니다.

#### 👤 전승자 프로필

아바타 이미지 업로드, 활동 지역·음식 취향 설정, 그리고 지금까지 전승한 레시피 수·받은 좋아요 수 등 통계를 한눈에 볼 수 있는 프로필 페이지입니다.

---

## 🛠️ 기술 스택

**Framework & Language**

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)

**Database & Infrastructure**

![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel)

**AI & APIs**

![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97706?style=flat-square&logo=anthropic&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Whisper%20%C2%B7%20DALL--E%203%20%C2%B7%20TTS-412991?style=flat-square&logo=openai&logoColor=white)
![Kakao](https://img.shields.io/badge/Kakao-Maps-FFCD00?style=flat-square&logo=kakao&logoColor=000)

**Docs**

![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=flat-square&logo=openapiinitiative&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-UI-85EA2D?style=flat-square&logo=swagger&logoColor=000)

---

## 💻 로컬 실행

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

## ⚙️ 환경변수

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

## 📁 프로젝트 구조

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
