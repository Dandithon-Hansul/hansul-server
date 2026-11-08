# 한술 백엔드
한술 백엔드 서버입니다.

## 배포

| 환경 | URL |
|------|-----|
| Production | https://hansul-server.vercel.app |
| Dev (develop 브랜치) | https://hansul-server-git-develop-eunhyes-projects-0b70d4c2.vercel.app |
| Swagger UI | https://hansul-server.vercel.app/api-docs |

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
