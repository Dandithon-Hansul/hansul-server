---
authored_with: Codex
features_used:
  - git-workflow-and-versioning
  - test-driven-development
  - documentation-and-adrs
  - code-review-and-quality
date: 2026-11-08
---

# 003. S-04 테스트 환경과 외부 연동 경계

Issue #8의 승인된 계획에 따라 Vitest와 ClaudePort, TtsPort, EmbeddingPort를 사용한다. 실제 API 키 없이도 서비스 로직을 검증할 수 있도록 fake 구현을 별도로 둔다. 현재 인터페이스는 복구한 초기 구현이며, 인터뷰 프롬프트 원문의 JSON 스키마 확인 후 실제 어댑터와 맞춰야 한다.

실제 서비스만 호출하는 테스트는 통합 확인에 유리하지만 키·네트워크와 호출 비용에 의존한다. fake는 빠르고 결정적이지만 실제 모델 출력·음성 형식·DB 정책을 검증하지 못한다. 실제 연동 검증은 별도로 남긴다. fake 음성 버퍼는 재생 가능한 MP3가 아니다.

개발 인증은 NODE_ENV=development에서만 X-Dev-User 헤더, 다음으로 DEV_USER_ID를 사용한다. 이외 환경에서는 Bearer 토큰을 Supabase auth.getUser로 검증한다. 개발 인증은 사용자 식별만 제공하므로 향후 서비스 역할 클라이언트를 사용하는 저장소 함수에는 반드시 소유자 필터를 적용해야 한다. 이 변경에서는 서비스 역할 기반 데이터 접근을 추가하지 않는다.

정식 로그인만 사용하는 대안은 우회 경로가 없어 단순하지만, 현재 미구축 인프라에서 개발을 막는다. 개발 인증은 임시 개발 수단이며 실제 배포에서는 정식 인증을 사용한다.

server-only 모듈은 Vitest에서만 빈 모듈로 대체한다. 운영 번들에는 해당 별칭이 적용되지 않는다. 다른 기능 디렉터리를 타입 검사나 테스트에서 제외하지 않는다.

공유 체크아웃에서 다른 브랜치 변경이 반복되는 문제를 피하기 위해 S-04는 별도 Orca worktree의 feature/chat에서 작업한다. 원래 온보딩 체크아웃의 변경은 보존한다.
