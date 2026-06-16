---
status: IN_PROGRESS
summary: "body-lab-api-nest 가 OIDC confidential client 와 body-lab session 발급을 담당한다."
---

# BODY_LAB_API_AUTH_BFF — body-lab-api-nest execution plan

Canonical orchestration plan:

`../../.idea/BODY_LAB_API_AUTH_BFF_PLAN.md`

## Repo Responsibility
`body-lab-api-nest` 는 body-lab 인증 BFF 이다. `auth-api-nest` 에 `body-lab-api` confidential OIDC client 로 로그인 요청/콜백/토큰 교환을 수행하고, mac/iOS 앱에는 body-lab 자체 opaque session 을 발급한다. 앱은 계속 `X-Body-Lab-Session` 으로 body-lab API 를 호출한다.

## Inputs / Dependencies
- Root plan: `../../.idea/BODY_LAB_API_AUTH_BFF_PLAN.md`
- Auth-side approved OIDC client:
  - `BODY_LAB_OIDC_CLIENT_ID=body-lab-api`
  - `BODY_LAB_OIDC_CLIENT_SECRET={approval modal one-time value}`
  - redirect URI:
    - local: `http://localhost:3020/session/oidc/callback`
    - prod: `https://lab.lafamila.xyz/session/oidc/callback`
- Current session code:
  - `src/auth/session.controller.ts`
  - `src/auth/body-lab-session.service.ts`
  - `src/auth/body-lab-session.guard.ts`
  - `src/auth/auth.service.ts`
- Current config:
  - `src/config/app-config.ts`
  - `src/config/config.service.ts`
  - `.env.example`
- Consuming app repo will use:
  - `POST /session/oidc/start`
  - `POST /session/oidc/complete`
  - `GET /session/me`
  - `POST /session/logout`
  - `X-Body-Lab-Session`

## Work Items
1. `.env.example` 갱신
   - `BODY_LAB_OIDC_CLIENT_ID=body-lab-api`
   - `BODY_LAB_OIDC_CLIENT_SECRET=`
   - `BODY_LAB_OIDC_REDIRECT_URI=http://localhost:3020/session/oidc/callback`
   - 필요하면 login transaction TTL env 를 추가한다.
   - service credential env 는 이번 범위에 추가하지 않는다.

2. Config 기본값 갱신
   - `oidcClientId` fallback 을 `body-lab-api` 로 바꾼다.
   - `oidcRedirectUri` fallback 을 `http://localhost:3020/session/oidc/callback` 로 바꾼다.
   - timezone/default env 원칙을 유지한다.

3. OIDC login transaction 모델 구현
   - `state`, PKCE verifier, client metadata, optional `returnUri`, expiry 를 저장하는 transaction store 를 만든다.
   - 초기 구현은 기존 session map 과 같은 in-memory 로 시작해도 되지만, restart 시 login transaction 이 사라지는 한계를 문서화한다.
   - session 자체도 현재 in-memory 라면 이 한계를 유지하되, persistent session 전환이 필요하면 orchestrator 에 보고한다.

4. `POST /session/oidc/start` 추가
   - body: `{ clientKind?: "ios" | "mac", clientInstanceId?: string, deviceName?: string, returnUri?: string }`
   - response: `{ authorizeUrl, loginTransactionId, expiresAt }`
   - `authorizeUrl` 은 auth-api-nest `/oauth/authorize` URL 이며 `client_id=body-lab-api`, `redirect_uri=BODY_LAB_OIDC_REDIRECT_URI`, `scope=openid profile email service.permission`, PKCE challenge 를 포함한다.
   - `returnUri` 는 native deep link 로 redirect 할 때만 사용하고, 허용 scheme allowlist 를 둔다.

5. `GET /session/oidc/callback` 추가
   - `code`, `state`, `error` 를 처리한다.
   - error 는 transaction 에 기록하고 minimal HTML 또는 return redirect 로 앱에 전달한다.
   - code 는 `/oauth/token` 에서 confidential client secret + PKCE verifier 로 교환한다.
   - access token 을 `AuthService.verifyBearerToken()` 으로 검증한다.
   - permission 이 없거나 `visitor` 면 body-lab session 을 만들지 않는다.
   - 성공 시 body-lab session 을 만들고 transaction 완료 상태로 저장한다.

6. `POST /session/oidc/complete` 추가
   - native app 이 `loginTransactionId` 또는 state-bound 값으로 완료된 body-lab session 을 가져온다.
   - response: `{ sessionId, user, expiresAt }`
   - session token 은 response 로 한 번 내려주고 앱은 Keychain 에 저장한다.
   - 같은 transaction 으로 session 을 반복 수령할 수 없게 처리한다.

7. 기존 direct ID/password login 제거
   - 현재 `POST /session/login` 이 auth `/login` 에 ID/PW 를 proxy 하는 구조라면 제거한다.
   - body-lab-api-nest 는 사용자 비밀번호를 받는 login endpoint 를 제공하지 않는다.
   - 로그인은 `POST /session/oidc/start` -> auth browser flow -> `GET /session/oidc/callback` -> `POST /session/oidc/complete` 만 지원한다.

8. Session guard / refresh / logout 유지
   - `X-Body-Lab-Session` 과 HttpOnly cookie extraction 은 유지한다.
   - access token 만료 직전 refresh token 으로 갱신하는 기존 로직은 유지한다.
   - refresh token reuse/rotation 문제가 발생하면 refresh 흐름을 auth-api-nest contract 에 맞춰 조정하고 orchestrator 에 보고한다.

9. Docs / CLAUDE.md 갱신
   - 이 레포의 auth decision 을 `body-lab-api` confidential client + app opaque session 으로 바꾼다.
   - native app 에 secret 이 없어야 한다는 점을 Security 섹션에 반영한다.
   - 새 env key 또는 변경 key 를 명시한다.

10. Tests
   - start endpoint authorize URL 생성 테스트.
   - callback success: token exchange mock -> session 생성.
   - callback error / invalid state / expired transaction.
   - complete endpoint one-time semantics.
   - visitor/no permission rejection.
   - `/session/me` 와 API guard 는 기존 `X-Body-Lab-Session` contract 유지.

## Acceptance Criteria
- `POST /session/oidc/start` 가 `body-lab-api` confidential client 기반 authorize URL 을 만든다.
- `GET /session/oidc/callback` 이 auth code 를 token 으로 교환하고 body-lab session 을 만든다.
- `POST /session/oidc/complete` 로 native app 이 body-lab session token 을 받아 Keychain 저장 가능한 형태로 쓸 수 있다.
- 앱-facing API 는 계속 `X-Body-Lab-Session` 을 받는다.
- `visitor` 또는 permission 없음은 body-lab no-access 로 거절된다.
- `.env.example` 이 새 env shape 의 source of truth 이다.
- 다음 명령이 통과한다.
  - `npm run build`
  - `npm run lint`
  - `npm test -- --runInBand`
  - `npm run test:e2e`

## Report Back To Orchestrator
- 최종 endpoint path / request / response contract.
- `body-lab-app-swift` 가 구현해야 할 login sequence.
- 새로 필요한 `.env` key 와 approval modal 에서 사용자가 복사해야 하는 값.
- direct `/session/login` 제거 결과와 영향을 받은 internal/admin 화면.
- session persistence 가 in-memory 로 남아 있다면 그 위험.

## Decision Escalation
사용자가 결정해야 하는 주요 사안은 임의로 판단하지 않는다. 작업을 중단하고 현재 orchestrator 에게 전달해 결정받은 뒤 진행한다. orchestrator 에 보고할 수 없으면 workspace root `.idea/` 에 handoff 문서를 남긴다.
