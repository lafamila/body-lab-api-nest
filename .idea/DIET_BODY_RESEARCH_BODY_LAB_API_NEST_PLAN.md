---
status: PREPARED
summary: "body-lab 배포 API 서버를 NestJS/PostgreSQL/Redis/auth-api-nest 통합 구조로 구현한다"
---

# DIET BODY RESEARCH — body-lab-api-nest execution plan

Canonical orchestration plan:

`../../.idea/DIET_BODY_RESEARCH_IDEA.md`

## Repo Responsibility
`body-lab-api-nest`는 배포되는 서버다. 계정별 body-lab 이벤트 데이터 저장, taxonomy 제공, client-generated prediction snapshot 저장, JSON export/import, `auth-api-nest` JWT 검증, Redis 기반 realtime sync를 담당한다.

서버는 현재 범위에서 분석/ML 엔진이 아니다. 초기 예측 알고리즘은 Swift shared module에서 실행되고, 서버는 그 결과를 저장/동기화한다.

## Inputs / Dependencies
- Root canonical plan: `../../.idea/DIET_BODY_RESEARCH_IDEA.md`
- Auth issuer/discovery: `auth-api-nest`
- Auth serviceKey: `body-lab`
- Required permission: `owner`
- DB: PostgreSQL database `body_lab`
- Redis: root deploy shared Redis, body-lab account-scoped sync notification channel
- Production domain: `lab.lafamila.xyz`
- Dev access: localhost and LAN IP base URLs

## Work Items
1. Scaffold NestJS project structure.
   - Keep repo-local package manager files.
   - Add `.gitignore`, Dockerfile, env example, src/test structure.
2. Add config layer.
   - PostgreSQL URL/host/user/password/db config
   - Redis URL config
   - auth issuer/audience/JWKS/discovery config
   - dev bind host/port config for LAN testing
3. Define PostgreSQL schema/migration strategy.
   - account-scoped tables for weight, meals, drinks, HealthKit imports, manual workouts, bathroom events, prediction snapshots, taxonomy, sync cursors
   - every user-owned row must be scoped by auth account id
4. Implement auth validation.
   - Fetch/cache discovery and JWKS
   - Verify issuer, signature, expiration, audience `service:body-lab`
   - Validate service claim key `body-lab`
   - Allow only permission `owner`; reject `visitor`
5. Implement taxonomy API.
   - Seed/read meal categories and exercise categories
   - Clients should read taxonomy from API, not hardcode categories
6. Implement event/log APIs.
   - morning fasted weight
   - meals and categories
   - water/coffee drinks and amount
   - HealthKit body mass/step/workout import summaries
   - manual workout records
   - bathroom events
7. Implement prediction snapshot API.
   - Store client-generated prediction v1 output and explanation components
   - Preserve actual-vs-predicted comparison data
8. Implement export/import API.
   - Export all account-scoped body-lab data to JSON
   - Import JSON back into the same authenticated account
   - Validate schema version and prevent cross-account import leakage
9. Implement realtime sync.
   - Persist writes first, then publish minimal account-scoped sync notification via Redis
   - Choose WebSocket or SSE and document rationale
   - Clients pull changed data after notification
10. Add tests.
   - auth guard
   - account scoping
   - export/import round-trip
   - taxonomy seed/read
   - prediction snapshot store/read
   - Redis sync smoke where feasible
11. Prepare deploy readiness.
   - Dockerfile builds
   - health endpoint
   - docs for env vars
   - note that `/repo-wrapup body-lab-api-nest` must later register root deploy files

## Acceptance Criteria
- NestJS project builds.
- Tests cover auth guard and account scoping.
- Docker image builds.
- API rejects missing token, wrong audience, wrong service claim, and non-owner permission.
- Authenticated owner can create/read/update/delete or append initial log types.
- Taxonomy API returns server-managed categories.
- Prediction snapshot can be saved and retrieved.
- Export/import round-trip preserves body-lab data for the authenticated account.
- Redis-backed sync notification path is implemented and smoke-tested or clearly documented with a local verification command.
- Env documentation includes production `lab.lafamila.xyz`, localhost, and LAN IP testing guidance.

## Report Back To Orchestrator
- If `auth-api-nest` token claim shape or client registration support is insufficient.
- If root Redis is not available or root deploy changes are needed earlier than repo-wrapup.
- If PostgreSQL migration tooling choice needs user approval.
- If API contract changes require `body-lab-app-swift` follow-up.

## Decision Escalation
사용자가 결정해야 하는 주요 사안은 임의로 판단하지 않는다. 작업을 중단하고 현재 orchestrator 에게 전달해 결정받고 진행한다. orchestrator 에 보고할 수 없으면 workspace root `.idea/` 에 handoff 문서를 남긴다.
