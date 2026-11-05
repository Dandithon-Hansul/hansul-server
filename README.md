# Gear-E Backend

Gear-E 백엔드 저장소입니다. 현재는 팀 공용 AI 작업 규칙과 셀프 리뷰 스킬, PR·이슈 템플릿을 제공합니다. 애플리케이션 코드와 실행·테스트 명령은 아직 포함하지 않습니다.

## 작업 환경

저장소 루트에서 Codex 또는 Claude Code를 실행합니다.

- Codex는 `AGENTS.md`와 `.agents/skills/self-review/SKILL.md`를 사용합니다.
- Claude Code는 `CLAUDE.md`와 `.claude/skills/self-review/SKILL.md`를 사용합니다.
- `CLAUDE.md`는 `AGENTS.md`를 가리키는 상대 심볼릭 링크입니다. 공통 운영 규칙은 `AGENTS.md`에서 관리합니다.
- 두 셀프 리뷰 스킬의 본문은 호출 표기를 제외하고 동일하게 유지합니다.

## 개발 흐름

일반 작업 PR의 base 브랜치는 `develop`입니다.

```text
Issue → 최신 develop에서 작업 브랜치 생성 → Draft PR
      → TDD·검증 → Ready for review → 셀프 리뷰
      → 필요 시 수정·재검증·재리뷰 → 사용자 병합 → develop
```

- 작업 브랜치는 `feature/*`, `fix/*`, `docs/*`, `chore/*` 형식을 사용합니다.
- 테스트·정적 검사·빌드·수동 확인 결과를 PR에 기록합니다. 미실행 항목은 이유와 위험을 기록합니다.
- PR 병합은 사용자가 수행합니다. 에이전트는 사용자 요청 없이 병합하지 않습니다.
- `develop → main` 승격 PR은 회의 시간에만 생성·검토·병합합니다. 통합 검증 결과, 알려진 위험, 롤백 방법과 승인 기록을 확인합니다.
- 최초 저장소 구성 시에는 `develop` 브랜치와 팀의 브랜치 보호 설정을 별도로 준비해야 합니다. 이 문서와 템플릿만으로 브랜치 보호가 적용되지는 않습니다.

상세 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다.

## 셀프 리뷰

Codex에서 호출합니다.

```text
$self-review
$self-review <PR 번호 또는 URL>
$self-review --base main
```

Claude Code에서 호출합니다.

```text
/self-review
/self-review <PR 번호 또는 URL>
/self-review --base main
```

- 인자가 없으면 현재 브랜치의 PR을 찾습니다. PR이 없으면 `develop` 기준의 로컬 변경을 검토합니다.
- `--base main`은 릴리즈 후보의 로컬 검토에 사용합니다.
- PR 조회에는 GitHub CLI인 `gh`와 해당 저장소에 접근 가능한 인증이 필요합니다. 조회에 실패하면 가능한 범위에서 로컬 검토를 계속하고 한계를 기록합니다.
- 리뷰 결과는 먼저 초안으로 공유합니다. GitHub 게시와 코드 수정에는 별도 승인이 필요합니다.
- `✅ 셀프 리뷰 통과`는 셀프 리뷰 판정입니다. 저장소의 병합 정책과 회의 승인 절차는 별도로 따릅니다.

스킬 정의: [Codex](.agents/skills/self-review/SKILL.md) · [Claude Code](.claude/skills/self-review/SKILL.md)

## PR·이슈 템플릿

아래 링크에서 PR 또는 이슈를 작성합니다.

| PR 방향 | 템플릿 | 작성 링크 |
| --- | --- | --- |
| 작업 브랜치 → develop | [default.md](.github/PULL_REQUEST_TEMPLATE/default.md) | [일반 PR 작성](https://github.com/Gear-E/gear-e-backend/compare/develop?expand=1&template=default.md) |
| develop → main | [release.md](.github/PULL_REQUEST_TEMPLATE/release.md) | [릴리즈 PR 작성](https://github.com/Gear-E/gear-e-backend/compare/main...develop?expand=1&template=release.md) |

일반 PR은 링크를 연 뒤 head를 작업 브랜치로 선택하고 Draft PR로 생성합니다. 릴리즈 PR은 정해진 회의 시간에만 생성·검토·병합합니다. 링크가 base와 템플릿을 지정하며, GitHub에서 브랜치만 바꿨을 때 템플릿이 자동 전환되지는 않습니다.

| 이슈 유형 | 템플릿 | 작성 링크 |
| --- | --- | --- |
| 기능 또는 개선 | [feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md) | [기능·개선 이슈 작성](https://github.com/Gear-E/gear-e-backend/issues/new?template=feature_request.md) |
| 버그 리포트 | [bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md) | [버그 이슈 작성](https://github.com/Gear-E/gear-e-backend/issues/new?template=bug_report.md) |

이슈는 브랜치와 관계없이 유형에 맞는 템플릿을 선택합니다. 이슈 제목과 본문은 한국어로 작성합니다. 관련 이슈가 있으면 PR 본문에 `Closes #번호`를 기록합니다.

템플릿은 GitHub의 기본 브랜치에 반영된 뒤 사용할 수 있습니다. 기본 브랜치가 아닌 `develop` 대상 PR의 `Closes`는 병합 시 이슈 자동 종료를 보장하지 않으므로 이슈 상태를 별도로 확인합니다.
# gear-e-backend
