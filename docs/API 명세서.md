# API 명세서

> **버전**: 0.1 | **작성일**: 2026-11-02 | **작성자**: BE
>

---

## 엔드포인트 목록

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| `GET` | `/api/profiles/me` | 내 프로필 조회 |
| `PATCH` | `/api/profiles/me` | 이름·지역·프로필 사진 수정 |
| `POST` | `/api/profiles/setup` | 역할 설정 (전승자·학습자) |
| `GET` | `/api/home` | 홈 피드 (인사말 + 이달의 TOP + 개인화 추천 통합) |
| `GET` | `/api/search/recipes` | 음식명·지역·전승자 통합 검색 |
| `POST` | `/api/uploads/sign` | Storage 직접 업로드 토큰 발급 |
| `POST` | `/api/stt` | Whisper STT — 오디오 → 텍스트 |
| `POST` | `/api/analyze` | 레시피 구조화 + 감각어 탐지 |
| `POST` | `/api/chat` | 채팅으로 레시피 보완 (이미지 첨부 가능, 스트리밍 텍스트+TTS) |
| `POST` | `/api/recipes` | 레시피 생성 (AI 처리 결과 저장) |
| `GET` | `/api/recipes` | 레시피 목록 조회 |
| `GET` | `/api/recipes/:id` | 레시피 상세 조회 |
| `POST` | `/api/recipes/:id/like` | 좋아요 토글 |
| `POST` | `/api/recipes/:id/save` | 저장 토글 |
| `POST` | `/api/evaluate` | 맛 평가 → AI 조정 제안 (스트리밍) |
| `POST` | `/api/steps/images` | 단계별 AI 이미지 일괄 생성 |
| `POST` | `/api/sensory/vectorize` | 손맛 프로파일 벡터 생성·저장 |
| `GET` | `/api/profiles/me/recipes` | 내가 전승한 레시피 목록 |
| `GET` | `/api/profiles/me/saved` | 저장한 레시피 목록 |
| `GET` | `/api/recommendations` | 개인화 추천 (food_preferences 기반) |
| `GET` | `/api/map/regions` | 대구·경북 지역 목록 (시·군 단위) |
| `GET` | `/api/map/regions/:region_code/recipes` | 선택 지역 인기 레시피 목록 |

---

## 0. UI 화면과 API 연결

| UI 화면 | 호출 API | 핵심 데이터 |
| --- | --- | --- |
| 온보딩 1단계 | `PATCH /api/profiles/me` | 이름 |
| 온보딩 2단계 | `PATCH /api/profiles/me` | 거주 지역 |
| 온보딩 3단계 | `PATCH /api/profiles/me` | 선호 음식 복수 선택 |
| 역할 설정 | `POST /api/profiles/setup` | 전승자·학습자 역할 |
| 홈 | `GET /api/home` | 인사말, 이달의 TOP, 추천 레시피 |
| 홈 검색 | `GET /api/search/recipes` | 음식명·지역·전승자 검색 결과 |
| AI 음성 기록 | `/api/stt` → `/api/analyze` → `/api/chat` | 녹음, transcript, 후속 질문 |
| 레시피 상세 | `GET /api/recipes/:id` | 대표 이미지, 전승자, 한마디, 시간·난이도·인분, 재료, 단계 |
| 단계별 만들기 | `GET /api/recipes/:id` | 단계별 이미지, 설명, 팁 |
| 지역 지도 | `GET /api/map/regions`, `GET /api/map/regions/:region_code/recipes` | 지역 목록, 선택 지역 인기 레시피 |
| 프로필 | `GET /api/profiles/me`, `GET /api/recipes` | 전승 레시피, 저장한 레시피, 좋아요 수 |

### P0·P1·P2 구현 범위 체크

| 우선순위 | 기능 | 문서 반영 위치 | 완료 기준 |
| --- | --- | --- | --- |
| P0 | 음성 기록 + 채팅 보완 | `/api/stt`, `/api/analyze`, `/api/chat` | 발화부터 텍스트·음성·이미지 답변과 최종 구조화까지 한 플로우로 동작 |
| P0 | 손맛 프로파일 | 감각 사전, `auto_applied`, `/api/sensory/vectorize` | 기존 해석 우선 적용, 불일치 항목만 재질문, 벡터 저장 |
| P0 | 레시피·단계 이미지·한마디 | `/api/recipes`, 단계 이미지, 음성 API | 목록·상세·마지막 단계까지 AI 이미지 표시·음성 재생 동작 |
| P0 | 전승자·학습자 분기 | `/api/profiles/setup`, `profiles.role`, RLS | 역할별 진입점과 권한 분리 |
| P0 | 지역 레시피 지도 | `/api/map/regions`, Kakao Maps, 데모 시드 | 대구·경북 폴리곤·레시피 프리뷰 노출 |
| P1 | 채팅 TTS 동시 출력 | `/api/chat (본문 tts: true)`, SSE chunk/audio | 텍스트 표시와 음성 재생이 겹쳐 진행 |
| P1 | 맛 평가와 조정 제안 | `/api/evaluate` | 평가 저장 후 다음 조리 조정안 출력 |
| P2 | 개인화 추천 | `/api/recommendations` | food_preferences 기반 추천 목록 반환 |

---

## 0-1. 내 프로필 및 온보딩

```
GET /api/profiles/me
Authorization: Bearer <access_token>

Response 200:
  {
    "id": "UUID",
    "display_name": "김한솔",
    "avatar_url": "https://...",
    "region": {"code": "47170", "sido": "경상북도", "sigungu": "안동시", "dong": "정하동"},
    "stats": {"transmitted_recipes": 2, "saved_recipes": 8, "likes_received": 34}
  }
```

```
PATCH /api/profiles/me
Authorization: Bearer <access_token>
Content-Type: application/json

Body:
  {
    "display_name": "김한솔",
    "region_code": "47170",
    "avatar_url": "https://..."
  }

Response 200:
  {
    "profile": {"id": "UUID", "display_name": "김한솔"}
  }
```

> 필드는 단계별로 일부만 보내도 된다.
>

---

## 0-1-1. 역할 설정

프론트엔드 진입 경로는 `/app/(auth)/setup`이며, 설정 저장은 다음 API를 사용한다.

```
POST /api/profiles/setup
Authorization: Bearer <access_token>
Content-Type: application/json

Body:
  {
    "display_name": "김한솔",
    "region_code": "47170",
    "food_preferences": ["된장찌개", "구이", "장조림"],
    "role": "transmitter"
  }

Response 200:
  {
    "profile_id": "UUID",
    "start_route": "/record"
  }
```

- `role`은 `transmitter` 또는 `learner`이다.
- 전승자는 음성 기록·채팅·레시피 생성, 학습자는 레시피 조회·단계별 조리·평가 화면으로 분기한다.

---

## 0-1-2. 프론트엔드 음성 기록 규약

- 지원 브라우저에서는 Web Speech API `SpeechRecognition`으로 실시간 transcript를 표시한다.
- `MediaRecorder`로 원본 음성을 동시에 보관하고, 미지원·실패 시 `/api/stt` Whisper fallback을 호출한다.
- 녹음 버튼은 Siri 스타일의 활성 파형·타이머·일시정지 상태를 표시한다.
- 사용자는 녹음 전 음식 사진을 첨부하고, transcript를 텍스트로 직접 보정할 수 있다.
- 확인 질문은 선택형과 자유 텍스트를 함께 제공한다. 음성 답변은 `/api/stt`로 변환한 뒤 `/api/chat` 메시지로 전달한다.

---

## 0-2. 홈 피드·검색

```
GET /api/home?limit=10
Authorization: Bearer <access_token>

Response 200:
  {
    "greeting_name": "한솔",
    "top_recipes": [
      {
        "recipe_id": "UUID",
        "title": "안동 찜닭",
        "hero_image_url": "https://...",
        "rank": 1
      }
    ],
    "recommended": [
      {
        "recipe_id": "UUID",
        "title": "안동 찜닭",
        "hero_image_url": "https://...",
        "region_tag": "안동시 정하동",
        "transmitter_name": "김영희",
        "transmitter_quote": "간장은 한 번에 붓지 말고",
        "like_count": 162,
        "save_count": 102,
        "is_liked": false,
        "is_saved": true
      }
    ],
    "next_cursor": null
  }
```

```
GET /api/search/recipes?q=찜닭&region_code=47170&cursor=&limit=20

Response 200:
  {
    "recipes": [
      {
        "recipe_id": "UUID",
        "title": "안동 찜닭",
        "hero_image_url": "https://...",
        "transmitter_name": "김영희",
        "region_tag": "안동시",
        "like_count": 162
      }
    ],
    "next_cursor": null
  }
```

> 검색어가 비어 있으면 최근 검색어 또는 추천 검색어를 반환할 수 있다.
>

---

## 0-3. 파일 직접 업로드

`POST /api/uploads/sign` (인증 필요, JSON)

- 요청은 `{ purpose, content_type, size_bytes, recipe_id? }`, 성공 응답은 `{ bucket, path, token }`이다.
- 용도별 제한은 `stt_audio` 25 MB, `chat_image`·`step_photo`·`evaluation_photo` 10 MB이다. 음성은 WebM/MP4/WAV, 이미지는 JPEG/PNG/WebP를 허용한다.
- 서버는 목적과 권한을 검사하고 비공개 버킷의 `{user_id}/{purpose}/{uuid}.{ext}` 경로에 업로드 토큰을 발급한다. STT 최초 호출과 평가 사진을 제외한 용도에는 대상 레시피 ID가 필요하며 작성자만 발급받을 수 있다. 평가 사진은 평가 가능한 레시피에만 연결할 수 있다.
- 채팅 이미지는 작성자 소유 초안에만 발급한다. 발급 기록 저장이 실패하면 토큰을 반환하지 않는다. 발급 기록이 없는 기존 이미지는 다시 업로드해야 한다.
- 브라우저는 Supabase `uploadToSignedUrl(path, token, file)`로 파일을 올리고 후속 API에 경로를 보낸다. 서버는 버킷·용도·소유자·대상에 대한 발급 기록과 실제 객체 크기 및 형식을 확인한 뒤 사용한다. 완성 사진은 권한 확인 후 읽기용 서명 URL로 응답한다.

---

## 1. STT

> 두 입력 중 하나만 보낸다. `audio_path`는 서버에서 전사하고, `transcript`는 브라우저 전사 또는 직접 수정한 텍스트를 사용한다. 최초 성공 시 작성자 소유 비공개 초안을 생성하며, `recipe_id`가 있으면 작성자 소유 초안만 갱신한다. 원본 녹음 경로는 서버에 저장한다.

```
POST /api/stt
Content-Type: application/json

Body:
  { audio_path: string, recipe_id?: UUID } 또는
  { transcript: string, recipe_id?: UUID }

Response 200:
  {
    transcript: string,
    recipe_id: UUID,
    status: "draft"
  }

Error:
  413  오디오 크기 초과
  415  지원하지 않는 포맷
```

---

## 2. 채팅 (레시피 보완 + 감각어 답변)

> 감각어 확인 질문에 대한 답변도 이 엔드포인트로 전달한다. 채팅 히스토리와 원본 transcript를 합산해 레시피를 최종 확정한다.
>

```
POST /api/chat
Content-Type: application/json

Body:
  { recipe_id: UUID, message: string, image_path?: string, tts?: boolean }
  tts 기본값: false

Response 200 (Server-Sent Events 스트리밍):
  Content-Type: text/event-stream

  event: chunk
  data: {"text": "갈비에 간장을"}

  event: chunk
  data: {"text": " 한 컵 넣어보세요."}

  event: audio
  data: {"sequence": 1, "url": "https://signed-url/segment-1.mp3"}

  event: done
  data: {"message_id": UUID, "audio_url": string | null}
  // FE는 text와 audio 이벤트를 독립적으로 처리해 표시와 재생을 겹쳐 수행한다.

Error:
  403  해당 사용자·레시피·채팅 용도로 발급된 이미지가 아님
  413  이미지 크기 초과
  415  지원하지 않는 이미지 형식
  422  recipe_id 없음 또는 객체 크기·형식이 발급 요청과 다름
```

> TTS 공급자는 OpenAI `tts-1`을 사용한다. 문장 단위로 생성된 오디오 조각을 SSE `audio` 이벤트로 보내 텍스트 스트림과 겹쳐 재생한다.
>

---

## 3. 분석 (구조화 + 감각어 탐지)

> 서버는 전승자의 `sensory_entries`에서 같은 표현을 먼저 조회한다. 확정된 기존 값은 `auto_applied`로 반환하고, 새 표현 또는 문맥상 불일치가 감지된 표현만 질문한다.
>

```
POST /api/analyze
Content-Type: application/json

Body:
  {
    recipe_id:      UUID

  }

Response 200:
  {
    structured: {
      ingredients: [{name, amount?, unit?}],
      steps:       [{order, action, sensory_expressions: string[]}],
      context:     {occasion?, for_whom?, season?}
    },
    questions: [
      {
        expression:    string,
        question:      string,
        options:       string[],
        already_known: boolean
      }
    ],
    auto_applied: [
      {expression, applied_value}
    ]
  }
```

---

## 4. 레시피 발행

> 작성자 소유 초안의 채팅·분석 결과를 검증하고 제목·재료·단계를 확정하여 발행한다. 발행 완료 후 같은 초안 ID로 재호출하면 기존 결과를 반환한다. 초안은 비공개이며, 이 MVP의 발행 동작은 공개 상태로 전환한다.

```
POST /api/recipes
Content-Type: application/json

Body:
  { recipe_id: UUID, transmitter_quote?: string }

Response 200:
  {
    recipe_id:         UUID,
    status:            "published",
    context_summary:   string,
    transmitter_quote: string | null,
    voice_message_url: string | null
  }
```

---

## 4-1. 작성자 한 마디 TTS

작성자가 직접 입력하거나 음성 입력에서 변환한 문장을 확인한 뒤 발행 요청의 transmitter_quote에 담는다. 앞뒤 공백을 제외하고 1~300자이며 생략할 수 있다.

서버는 최초 발행과 같은 트랜잭션에서 문장을 저장한다. 이어서 TTS로 합성한 MP3를 비공개 card-voice 버킷에 저장하고 발행·상세 응답에서 voice_message_url로 서명 URL을 제공한다. 합성 또는 저장에 실패하면 레시피는 발행된 상태를 유지하고 문장을 텍스트로 보여준다. 같은 레시피를 다시 발행 요청해도 기존 문장과 음성은 바뀌지 않는다.

---

## 5. 맛 평가 → AI 피드백

> AI 조정 제안 모델은 Claude를 사용하며, 모델명은 서버 환경 변수로 교체 가능하게 둔다.
>

```
POST /api/evaluate
Content-Type: application/json

Body:
  {
    recipe_id:  UUID,

    evaluation: {
      salt:          -2 | -1 | 0 | 1 | 2,
      consistency:   -2 | -1 | 0 | 1 | 2,
      doneness:      -2 | -1 | 0 | 1 | 2,
      overall:       1 | 2 | 3,
      rule_followed: boolean
    },
    photo_path?: string
  }

Response 200 (Server-Sent Events 스트리밍):
  Content-Type: text/event-stream

  event: chunk
  data: {"text": "지난번보다 소금을"}

  event: chunk
  data: {"text": " 0.3g 줄이고,"}

  event: done
  data: {"session_id": UUID}
```

---

## 6. 단계별 AI 이미지 일괄 생성

> 이미지 생성 모델은 서버의 IMAGE_MODEL로 설정한다. 작성자는 발행 완료 후 호출한다. 재호출 시 이미 저장된 단계 이미지를 재사용한다. 생성된 파일은 Storage에 저장하고 API는 이미지 URL을 반환한다.
>

```
POST /api/steps/images
Content-Type: application/json

Body:
  { recipe_id: UUID }

Response 200:
  {
    generated: [
      {
        order:       number,
        image_url:   string,
        prompt_used: string
      }
    ],
    failed_orders: number[]
  }

// 생성 대상에 마지막 단계를 포함한다.
```

---

## 7. 레시피 목록 조회

```
GET /api/recipes?region_code=47170&sort=popular&cursor=&limit=20

Response 200:
  {
    recipes: [
      {
        recipe_id:        UUID,
        title:            string,
        hero_image_url:   string | null,
        transmitter_name: string,
        region:           string,
        like_count:       number,
        created_at:       string
      }
    ],
    next_cursor: string | null
  }
```

> `sort=popular`이면 `like_count + save_count` 합산 기준으로 정렬한다.
>

---

## 8. 레시피 상세 조회

```
GET /api/recipes/:id
Authorization: Bearer <access_token>

Response 200:
  {
    recipe_id:         UUID,
    title:             string,
    hero_image_url:    string | null,
    transmitter_id:    UUID,
    transmitter_name:  string,
    transmitter_quote: string | null,
    context_summary:   string,
    voice_message_url: string | null,
    cooking_time:      number,             // 분 단위
    difficulty:        "쉬움" | "보통" | "어려움",
    servings:          number,
    like_count:        number,
    save_count:        number,
    is_liked:          boolean,
    is_saved:          boolean,
    ingredients: [
      {name: string, amount: number | null, unit: string | null, note: string | null}
    ],
    steps: [
      {
        order:       number,
        title:       string,
        description: string,
        image_url:   string | null,
        tip:         string | null,
        is_key_step: boolean
      }
    ],
    version:    number,
    updated_at: string
  }

Error:
  404  레시피 없음
  403  비공개 레시피에 접근 권한 없음
```

> 탐색·검색·지도에는 `status=published` 및 `visibility=public`인 레시피만 노출한다. 원본 음성, 전체 transcript, 내부 감각 사전과 조리 평가 기록은 응답에서 제외한다.
>

---

> 상세 응답의 transmitter_id로 작성자 공개 프로필을 연다. 단계별 안내는 마지막 단계까지 steps[].image_url을 표시하며, 값이 없으면 기본 이미지를 표시한다.

## 8-1. 좋아요·저장

```
POST /api/recipes/:id/like
POST /api/recipes/:id/save
Authorization: Bearer <access_token>

Response 200:
  {
    "recipe_id": "UUID",
    "liked":     true,
    "saved":     true,
    "like_count": 163,
    "save_count": 103
  }
```

> 동일 요청을 반복하면 토글된다 (좋아요 → 좋아요 취소).
>

---

## 8-2. 작성자 공개 프로필

GET /api/profiles/:id는 로그인한 사용자에게 공개 발행 레시피가 있는 작성자의 이름·사진·지역·소개와 공개 레시피 목록 및 통계를 반환한다. 편집과 저장 목록은 내 프로필 API에서만 제공한다.

---

## 9. 손맛 프로파일 벡터화

```
POST /api/sensory/vectorize
Content-Type: application/json

Body:
  {}

Response 200:
  {
    profile_summary: string,
    dimensions: {
      salt_intensity:      number | null,
      liquid_reduction:    number | null,
      sweet_ratio:         number | null,
      browning_preference: number | null,
      spice_tolerance:     number | null
    },
    vector_updated: boolean
  }

Error:
  422  확정된 감각 항목 부족 (확정 감각 항목 1개 이상 필요)
```

---

> 미확인 차원은 `null`이다(2026-11-08 사용자 승인). 현재 정규화된 맛 강도 확인값은 저장하지 않으므로 5개 차원 모두 `null`을 반환한다. 수량이나 confidence를 맛 강도로 바꾸지 않는다. 프로필 벡터는 인증된 전승자의 확정 감각 사례 요약을 임베딩한 1536차원 값이며, 원본 벡터는 응답에 포함하지 않는다.

## 10. 지역 지도

```
GET /api/map/regions

Response 200:
  {
    regions: [
      { region_code: "47170", region: "안동시", recipe_count: 12 },
      { region_code: "47130", region: "경주시", recipe_count: 8 }
    ]
  }
```

```
GET /api/map/regions/:region_code/recipes?limit=10

Response 200:
  {
    region: "안동시",
    recipes: [
      {
        recipe_id:        UUID,
        title:            string,
        hero_image_url:   string | null,
        transmitter_name: string,
        like_count:       number,
        save_count:       number
      }
    ]
  }
```

> 프론트엔드는 공공데이터포털 GeoJSON(정적 번들)으로 폴리곤을 렌더링하고 Kakao Maps 베이스 맵 위에 오버레이한다. 핀을 누르면 해당 지역 인기 레시피 목록이 바텀 시트에 표시된다. MVP는 대구·경북을 제공하고 동일한 행정구역 코드 구조로 전국 확장이 가능해야 한다.
>

---

## 10-1. 내가 전승한 레시피 목록

```
GET /api/profiles/me/recipes?cursor=&limit=20
Authorization: Bearer <access_token>

Response 200:
  {
    recipes: [
      {
        recipe_id:      UUID,
        title:          string,
        hero_image_url: string | null,
        like_count:     number,
        save_count:     number,
        created_at:     string
      }
    ],
    next_cursor: string | null
  }
```

---

## 10-2. 저장한 레시피 목록

```
GET /api/profiles/me/saved?cursor=&limit=20
Authorization: Bearer <access_token>

Response 200:
  {
    recipes: [
      {
        recipe_id:        UUID,
        title:            string,
        hero_image_url:   string | null,
        transmitter_name: string,
        saved_at:         string
      }
    ],
    next_cursor: string | null
  }
```

---

## 11. 개인화 추천

```
GET /api/recommendations?limit=10
Authorization: Bearer <access_token>

Response 200:
  {
    recipes: [
      {
        recipe_id:         UUID,
        title:             string,
        hero_image_url:    string | null,
        region_tag:        string,
        transmitter_quote: string
      }
    ]
  }
```

> `food_preferences` 기반으로 추천한다.
>

---

## 12. 공통 규약

- 사용자 ID는 검증한 Supabase 세션에서 가져오고, 쓰기 API는 서버에서 역할 및 대상 리소스 권한을 검사한다.
- 탐색·검색·지도·추천에는 공개 발행 레시피만 포함한다. 초안·비공개 상세는 작성자만 열람한다.
- SSE 연결 전 오류는 HTTP JSON 응답으로, 연결 이후 오류는 SSE error 이벤트로 반환한다.
- 단계 이미지 일괄 생성은 마지막 단계까지 포함한다. 실패한 단계는 failed_orders로 반환한다.

- 인증이 필요한 API는 `Authorization: Bearer <Supabase access token>`을 사용한다.
- 성공 응답은 JSON이며, 비동기 스트리밍 API는 `text/event-stream`을 사용한다.
- SSE 이벤트는 `chunk`, `audio`, `done`, `error`로 구분한다. TTS 활성화 시 `audio` 이벤트에 짧은 수명의 오디오 URL을 전달한다.
- 목록 API는 `cursor`, `limit`을 받고 `{ recipes, next_cursor }` 형태로 페이지네이션한다.
- 모든 시각은 ISO 8601 UTC 문자열로 반환하고 화면에서 사용자 시간대로 변환한다.

### 12-1. 에러 응답 형식

모든 에러 응답은 다음 형식을 따른다.

```json
{
  "code": "RECIPE_NOT_FOUND",
  "message": "레시피를 찾을 수 없습니다.",
  "details": {}
}
```

SSE 스트리밍 중 에러가 발생하면 다음 이벤트를 보내고 스트림을 닫는다.

```
event: error
data: {"code": "AI_TIMEOUT", "message": "AI 응답 시간을 초과했습니다."}
```

### 12-2. HTTP 상태 코드

| 상태 코드 | 의미 |
| --- | --- |
| 200 | 성공 |
| 201 | 생성 성공 |
| 204 | 성공 (응답 본문 없음) |
| 400 | 잘못된 요청 (필수 필드 누락, 형식 오류) |
| 401 | 인증 필요 (토큰 없음 또는 만료) |
| 403 | 권한 없음 (본인 소유 아닌 리소스 접근) |
| 404 | 리소스 없음 |
| 413 | 파일 크기 초과 |
| 415 | 지원하지 않는 미디어 타입 |
| 422 | 처리 불가 (비즈니스 규칙 위반) |
| 500 | 서버 내부 오류 |

### 12-3. 에러 코드 목록

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | 인증 토큰 없음 또는 만료 |
| `FORBIDDEN` | 403 | 리소스 접근 권한 없음 |
| `RECIPE_NOT_FOUND` | 404 | 레시피 없음 |
| `PROFILE_NOT_FOUND` | 404 | 프로필 없음 |
| `STEP_NOT_FOUND` | 404 | 해당 단계 없음 |
| `FILE_TOO_LARGE` | 413 | 파일 크기 초과 |
| `UNSUPPORTED_FORMAT` | 415 | 지원하지 않는 파일 포맷 |
| `MISSING_FIELD` | 422 | 필수 필드 누락 |
| `INVALID_ROLE` | 422 | 유효하지 않은 역할 값 |
| `SENSORY_INSUFFICIENT` | 422 | 감각 항목 부족 (확정 감각 항목 1개 이상 필요) |
| `AUDIO_TRANSCRIPTION_FAILED` | 422 | 음성 변환 실패 |
| `INGREDIENT_UNRECOGNIZED` | 422 | 재료 인식 불가 |
| `AI_TIMEOUT` | 500 | AI 응답 시간 초과 |
| `AI_ERROR` | 500 | AI 처리 중 내부 오류 |
| `STORAGE_ERROR` | 500 | 파일 저장 실패 |
