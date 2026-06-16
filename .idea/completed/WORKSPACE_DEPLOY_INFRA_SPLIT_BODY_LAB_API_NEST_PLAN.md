---
status: COMPLETED
completed_at: 2026-06-16
completion_reason: "Implemented infra-only root deployment model and repo deployment documentation."
summary: "body-lab-api-nest 를 독립 배포 API 로 문서화하고 root compose 의 body-lab 앱 전제를 제거한다."
---

# WORKSPACE DEPLOY INFRA SPLIT — body-lab-api-nest execution plan

Canonical orchestration plan:

`../../.idea/WORKSPACE_DEPLOY_INFRA_SPLIT_PLAN.md`

## Repo Responsibility
`body-lab-api-nest` 는 body-lab native app 들의 BFF/session boundary 이며 독립 운영 배포 대상이다. root compose 에 앱 서비스로 묶이지 않고, 자체 Dockerfile/env/deploy 문서를 가진다.

## Inputs / Dependencies
- PostgreSQL 과 Redis 는 root infra compose 또는 운영 infra 를 사용할 수 있다.
- `auth-api-nest` 는 독립 배포 auth host 로 접근한다.
- native clients 는 이 API host 를 직접 선택/저장한다.

## Work Items
1. `CLAUDE.md` 의 "루트 배포 묶음에 등록될 예정" 표현을 독립 배포 표현으로 바꾼다.
2. README / `.env.example` 에 PostgreSQL, Redis, auth OIDC/client secret, public base URL 값을 독립 배포 기준으로 정리한다.
3. Dockerfile 이 root compose 내부 DNS 에 고정되어 있지 않은지 확인한다.
4. local run, test, Docker build 명령을 분리해 문서화한다.
5. body-lab native clients 가 사용하는 API host switch 흐름과 충돌이 없는지 확인한다.

## Acceptance Criteria
- root compose 앱 서비스 전제가 제거된다.
- `.env.example` 에 독립 운영 env shape 가 명확하다.
- local command 와 Docker build command 가 분리된다.
- Redis/Postgres dependency 가 root infra 또는 운영 infra 로 표현된다.

## Report Back To Orchestrator
- body-lab-app-swift 와 맞춰야 하는 base URL/default host 변경.
- auth onboarding/OIDC redirect URI/env 변경.
- Redis 를 공통 infra 로 두는 데 문제가 있는 경우.

## Decision Escalation
사용자가 결정해야 하는 주요 사안은 임의로 판단하지 않는다. 작업을 중단하고 현재 orchestrator 에게 전달해 결정받은 뒤 진행한다. orchestrator 에 보고할 수 없으면 workspace root `.idea/` 에 handoff 문서를 남긴다.

