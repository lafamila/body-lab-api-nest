---
status: COMPLETED
summary: "body-lab BFF OIDC 흐름을 auth-hosted login 계약 기준으로 정리하고 stale login 문서를 제거한다."
completed_at: 2026-06-16
completion_reason: "body-lab BFF contract 정리 및 로컬 검증 완료"
---

# AUTH_HOSTED_LOGIN_PLAN — body-lab-api-nest execution plan

Canonical orchestration plan:

`../../.idea/AUTH_HOSTED_LOGIN_PLAN.md`

## Repo Responsibility
body-lab native clients 를 위한 BFF session owner 역할을 유지한다. auth-api-nest credential 은 직접 받지 않고 OIDC start/callback/complete 흐름만 제공한다.

## Inputs / Dependencies
- `BODY_LAB_OIDC_REDIRECT_URI` 는 auth-api-nest 에 등록된 exact redirect URI 여야 한다.
- native return URI 는 `returnUri` request body 로 받아 BFF callback 이후 앱으로 돌려보내는 값이다.
- body-lab-app-swift 는 `/session/oidc/start` 와 `/session/oidc/complete` 를 사용한다.
- access denied 는 auth 공통 화면이 아니라 body-lab-api-nest/body-lab app 이 role/permission claim 또는 callback/token error 를 기준으로 처리한다.

## Work Items
1. `/session/oidc/start`, `/session/oidc/callback`, `/session/oidc/complete` 가 root plan contract 와 일치하는지 검토한다.
2. `prediction-config.controller.ts` 의 `Login with Teddy Auth` 버튼 문구를 `로그인`으로 변경한다.
3. body-lab service login 시작 화면에 불필요한 auth 설명 copy 가 있으면 제거한다.
4. README 의 `POST /session/login` 문서를 OIDC start/callback/complete 흐름으로 갱신한다.
5. service tests 에서 authorize URL, redirect URI, state, PKCE, callback completion 을 고정한다.
6. access denied/error 가 native app 으로 명확히 전달되는지 확인한다.
7. client secret/service credential 이 client-facing response 에 노출되지 않는지 확인한다.

## Acceptance Criteria
- body-lab-api-nest 는 중앙 계정 ID/PW 를 받는 endpoint 를 문서화하거나 제공하지 않는다.
- config/admin web login 버튼 문구가 `로그인`이다.
- README 는 `/session/oidc/start`, `/session/oidc/callback`, `/session/oidc/complete` 흐름을 설명한다.
- native custom scheme 이 auth redirect URI 와 혼동되지 않도록 문서와 테스트가 명확하다.
- `npm test` 또는 관련 spec 이 통과한다.

## Report Back To Orchestrator
- body-lab-app-swift 가 변경해야 하는 endpoint/response shape 변화가 있었는지.
- auth-api-nest redirect URI 등록 변경 필요 여부.

## Decision Escalation
사용자가 결정해야 하는 주요 사안은 임의로 판단하지 않는다. 작업을 중단하고 현재 orchestrator 에게 전달해 결정받은 뒤 진행한다. orchestrator 에 보고할 수 없으면 workspace root `.idea/` 에 handoff 문서를 남긴다.
