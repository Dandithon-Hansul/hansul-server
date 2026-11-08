---
authored_with: Claude Code
features_used:
  - superpowers:brainstorming
  - superpowers:writing-plans
date: 2026-11-08
---

# 002. role(전승자/학습자) 개념 제거

## 배경

초기 설계는 transmitter/learner role로 사용자를 구분하고 온보딩에서 역할 선택 화면을 뒀다.
S-01 화면에서 역할 선택을 제거하기로 했고, MVP 범위에서 역할 구분은 복잡도만 높인다고 판단했다.

## 결정

- `profiles.role` 컬럼과 CHECK 제약을 제거한다.
- `POST /api/profiles/setup` 응답에서 role 필드를 제거하고 `start_route`는 항상 `"/"`로 반환한다.
- SQL 함수·정책에서 role 조건을 제거한다.
- `recipes.transmitter_id` FK는 역할과 무관하므로 유지한다.

## 검토한 대안

- role 유지 + 기본값 transmitter: 미사용 분기와 스키마 복잡도 잔존.
- role nullable: 의미 없는 컬럼이 모델에 남아 혼란.
- **전체 제거(선택)**: 데이터 모델·API·UI 일관성 최상.

## 영향

- `feature/recipe-detail`: 마이그레이션에서 role 컬럼·CHECK·함수 조건 제거 필요.
- `feature/my-profile`: `readProfile` select에서 role 필드 제거 필요.
- 머지 순서: onboarding-setup → recipe-detail(리베이스) → my-profile(리베이스)
