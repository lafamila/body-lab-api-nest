# body-lab-api-nest

Deployable NestJS API for body-lab account-scoped logs, taxonomy, prediction snapshots, JSON export/import, and Redis-backed realtime sync.

The server is a data and sync hub. It stores events and client-generated prediction snapshots; it does not run the analytics engine.

## Runtime Contracts

- Auth service key: `body-lab`
- JWT audience: `service:body-lab`
- Required permission: `owner`
- `visitor` or missing body-lab permission is denied
- Production URL: `https://lab.lafamila.xyz`
- Local Mac/simulator URL: `http://localhost:3020`
- Physical iPhone dev URL: `http://{LAN_IP}:3020`
- Local dev should bind `HOST=0.0.0.0` when testing from another device on the LAN

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL database `body_lab`
- `REDIS_URL`: shared Redis used for minimal sync notifications
- `AUTH_ISSUER_URL`: auth-api-nest issuer
- `AUTH_JWKS_URL`: optional direct JWKS URL; if omitted the API uses OIDC discovery from the issuer
- `AUTH_AUDIENCE`: defaults to `service:body-lab`
- `AUTH_SERVICE_KEY`: defaults to `body-lab`
- `AUTH_REQUIRED_PERMISSION`: defaults to `owner`

## Commands

```bash
npm install
npm run db:migrate
npm run build
npm run lint
npm run test
npm run test:e2e
docker build -t body-lab-api-nest .
```

## API Surface

- `GET /health`
- `GET /taxonomy`
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

All domain routes require a valid bearer token from auth-api-nest.
