---
authored_with: Codex
features_used:
  - incremental-implementation
  - claude-api
  - test-driven-development
  - security-and-hardening
  - documentation-and-adrs
date: 2026-11-08
---

# 004. 인터뷰 원문 계약과 문맥별 감각 확인 사례

사용자가 제공한 인터뷰 프롬프트 전문을 보존한다. 내부 Analysis와 공개 API DTO를 분리해 ASR 후보·미확인 항목·복합 조리 정보를 ai_analysis에 보존한다. 기존 API 명세서의 ingredients/steps/context 응답은 별도 매핑한다. 내부 모델 반환에는 Zod 검증을 적용하고 형식 오류만 한 번 재시도한다. Claude 시스템 프롬프트에는 캐시 경계를 둔다.

기존 sensory_entries의 UNIQUE(transmitter_id, expression)는 같은 표현의 문맥별 사례 축적과 충돌한다. 기존 테이블과 제약을 바꾸는 대안은 다른 팀 기능에 영향을 준다. 따라서 S-04의 문맥·답변 근거·차원·임베딩은 추가 테이블 sensory_cases에 저장한다. 기존 sensory_entries는 별도 문맥 근거가 없으므로 자동 적용 대상에서 제외한다. 새 사례는 기존 값을 덮어쓰지 않고 추가한다. 동일 답변을 두 번 확인하면 confidence를 높이며, 충돌하는 값은 자동 재사용하지 않는다. 이 테이블은 내부 데이터이며 일반 클라이언트 권한을 부여하지 않는다.

자동 적용은 같은 전승자·음식·차원·문맥의 확인 사례에 한정한다. 같은 표현을 먼저 검색하고, 없으면 같은 문맥 내 임베딩 cosine 0.85 이상을 후보로 삼는다. 임계값은 제품 데이터로 측정한 값이 아니므로 실측 보정이 필요하다. 문맥 문자열 비교는 보수적으로 정확 일치를 사용한다. 재사용률은 낮아질 수 있지만 용기나 조리 조건이 다른 값을 적용할 위험을 줄인다.

확정 사례는 직전 즉시 질문 대상에 대한 사용자 답변 원문이 존재할 때만 축적한다. 모델의 confidence만으로 저장하지 않는다. 모델은 확인된 답변에 source=user_answer를 사용하고 interpreted_value에 사용자 답변의 정확한 부분 문자열을 기록해야 한다. 이 제약으로 추론만으로 만들어진 수치가 사전에 축적되는 것을 줄인다. 의미적 진실성까지 보장하는 것은 아니므로 실제 발화 평가가 필요하다.

프로필 벡터는 확정 사례 요약의 1536차원 임베딩이다. API dimensions의 5개 수치에는 기존 명세에 척도가 없다. confidence를 맛의 강도로 바꾸거나 근거 없는 수치를 생성하지 않는다. 숫자 척도와 미확인 차원의 null 허용 여부는 사용자에게 확인 중이며, 해당 응답 계약은 확인 후 확정한다.

DB 변경은 마이그레이션 파일로만 제공하고 원격에 자동 적용하지 않는다. 기본 스키마는 feature/home-feed의 공통 마이그레이션 병합에 의존하며 복제하지 않는다. 이 브랜치의 추가 마이그레이션은 profiles/recipes/transmission_cards/chat_messages와 vector 확장이 이미 존재해야 한다. 온보딩의 role 제거 결정과 통합 순서도 병합 전에 맞춰야 한다. S-03가 이미 구현된 상황이므로 임시 공개 시드 엔드포인트를 추가하지 않고 테스트 fixture를 사용한다.

기존 상세 조회와의 호환성을 위해 ai_analysis 루트의 must_keep/can_change/unresolved/context를 유지하고 전체 인터뷰 분석은 interview 하위에 보존한다. 분석 시점의 마지막 메시지 ID를 기록하고, 이후 새 대화가 추가된 초안의 발행은 재분석 전까지 거부한다.

문장 단위 음성은 즉시 재생용으로 만들고, 보관용 전체 음성은 전체 응답으로 별도 합성한다. MP3 바이트를 단순 연결하면 플레이어에 따라 일부 구간만 재생할 수 있으므로 재합성을 선택했다. 이에 따라 TTS 호출량은 텍스트 길이 기준 약 두 배가 된다.

같은 트랜잭션에서 now()가 동일할 수 있으므로 채팅 순서는 s04_sequence(identity)로 확정한다. SQL 회귀 테스트는 새 메시지가 추가된 뒤 이전 분석으로 발행하는 경우를 포함한다.

공식 OpenAI 문서(2026-11-08 확인)는 tts-1의 종료일을 2027-01-06로 안내한다. 승인된 모델은 그대로 유지하며 이후 API 전환은 별도 작업으로 남긴다. https://developers.openai.com/api/docs/guides/text-to-speech
