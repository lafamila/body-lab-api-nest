# body-lab-api-nest

Independently deployed NestJS API/BFF for body-lab account-scoped logs, taxonomy, prediction snapshots, JSON export/import, and Redis-backed realtime sync.

The server is a data and sync hub. It stores events and client-generated prediction snapshots; it does not run the analytics engine.

This repo is not a root `docker-compose.yml` app service. For local/dev it can use PostgreSQL, Redis, and auth infrastructure from the workspace root infra compose, but the API itself is expected to run via local commands or its own Docker image/deployment.

## Runtime Contracts

- Auth service key: `body-lab`
- JWT audience: `service:body-lab`
- Allowed permission: any body-lab permission except `visitor`
- `visitor` or missing body-lab permission is denied
- Login flow uses hosted OIDC through `POST /session/oidc/start`, `GET /session/oidc/callback`, and `POST /session/oidc/complete`
- `BODY_LAB_OIDC_REDIRECT_URI` must exactly match the auth-api-nest OIDC client redirect URI and should point to this BFF callback, for example `http://localhost:3020/session/oidc/callback`
- Native app custom schemes such as `bodylab://auth/callback` and `bodylab-mac://auth/callback` are return URIs used after this BFF callback completes; they are not auth-api-nest redirect URIs
- Client-facing responses contain only the hosted authorize URL, login transaction id, opaque body-lab session, and callback status/error fields. They never include the OIDC client secret or service credential.
- Production URL: `https://lab.lafamila.xyz`
- Local Mac/simulator URL: `http://localhost:3020`
- Physical iPhone dev URL: `http://{LAN_IP}:3020`
- Local dev should bind `HOST=0.0.0.0` when testing from another device on the LAN
- Auth-side service setup is request-driven: submit a `body-lab` service onboarding request to `auth-api-nest`, approve it in `/admin`, then copy any one-time OIDC/service credential secrets into this service's `.env` or secret manager. Do not create or edit body-lab service specs through direct auth admin write endpoints.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL database `body_lab`, provided by local root infra compose or deployment infrastructure
- `REDIS_URL`: shared Redis used for minimal sync notifications, provided by local root infra compose or deployment infrastructure
- `AUTH_ISSUER_URL`: independently deployed `auth-api-nest` issuer
- `AUTH_API_BASE_URL`: independently deployed `auth-api-nest` API base URL used for this BFF's OIDC authorize/token/revoke calls
- `AUTH_JWKS_URL`: optional direct JWKS URL; if omitted the API uses OIDC discovery from the issuer
- `AUTH_AUDIENCE`: defaults to `service:body-lab`
- `AUTH_SERVICE_KEY`: defaults to `body-lab`
- `AUTH_DENIED_PERMISSIONS`: comma-separated denied permission values; defaults to `visitor`
- `BODY_LAB_OIDC_CLIENT_ID`: auth-api-nest OIDC client id registered for body-lab native clients
- `BODY_LAB_OIDC_CLIENT_SECRET`: required confidential client secret stored only on this API server
- `BODY_LAB_OIDC_REDIRECT_URI`: redirect URI registered for the OIDC client; this must stay distinct from any native app custom scheme return URI
- `BODY_LAB_SESSION_COOKIE_NAME`: optional cookie name for browser-style clients
- `BODY_LAB_SESSION_MAX_AGE_SECONDS`: body-lab session lifetime
- `BODY_LAB_LOCAL_TIME_ZONE`: local date boundary used by day views and daily weight uniqueness; defaults to `Asia/Seoul`

Permission definitions, OIDC client redirect URIs/scopes, and backend credential scopes are owned by the approved auth service onboarding request. Changes require a new onboarding update request rather than manual auth admin mutation.

## Local Dev Commands

```bash
npm install
npm run db:migrate
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Docker / Deploy Commands

```bash
docker build -t body-lab-api-nest .
```

## API Surface

- `GET /health`
- `POST /session/oidc/start`
- `GET /session/oidc/callback`
- `POST /session/oidc/complete`
- `GET /session/me`
- `POST /session/logout`
- `GET /taxonomy`
- `GET /days/:date`
- `PATCH /days/:date`
- `POST /logs/weights`, `GET /logs/weights`, `PATCH /logs/weights/:id`, `DELETE /logs/weights/:id`
- `POST /logs/meals`, `GET /logs/meals`, `PATCH /logs/meals/:id`, `DELETE /logs/meals/:id`
- `POST /logs/drinks`, `GET /logs/drinks`, `PATCH /logs/drinks/:id`, `DELETE /logs/drinks/:id`
- `POST /logs/health-imports`, `GET /logs/health-imports`, `PATCH /logs/health-imports/:id`, `DELETE /logs/health-imports/:id`
- `POST /logs/manual-workouts`, `GET /logs/manual-workouts`, `PATCH /logs/manual-workouts/:id`, `DELETE /logs/manual-workouts/:id`
- `POST /logs/bathroom`, `GET /logs/bathroom`, `PATCH /logs/bathroom/:id`, `DELETE /logs/bathroom/:id`
- `POST /predictions`, `GET /predictions`, `PATCH /predictions/:id`, `DELETE /predictions/:id`
- `GET /export`
- `POST /import`
- `GET /sync/events` for server-sent events; clients pull changed records after each notification

All domain routes require a valid body-lab session. Native clients send it through `X-Body-Lab-Session`; browser-style clients can use the `body_lab_session` cookie.

## OIDC Login Flow

1. Client calls `POST /session/oidc/start` with optional `clientKind`, `clientInstanceId`, `deviceName`, and `returnUri`.
2. The response returns `authorizeUrl`, `loginTransactionId`, and `expiresAt`. The client opens `authorizeUrl`.
3. auth-api-nest handles hosted login and redirects back to this service's fixed `BODY_LAB_OIDC_REDIRECT_URI`.
4. `GET /session/oidc/callback` exchanges the authorization code server-side, creates the opaque body-lab session, and then:
   - redirects to the supplied `returnUri` with `status`, `loginTransactionId`, `errorCode`, and `error` query params when a return URI was supplied, or
   - redirects to `/admin` or renders a small completion/error page when no return URI was supplied.
5. Native clients finish by calling `POST /session/oidc/complete` with `loginTransactionId` to receive the opaque `sessionId`, `user`, and `expiresAt`.

Access denied remains service-owned UX. Native clients should treat `status=error` or `errorCode=access_denied` from the return URI, or a `401` from `POST /session/oidc/complete`, as a body-lab login denial and render their own no-access screen.
