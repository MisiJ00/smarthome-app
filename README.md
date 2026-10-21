# smarthome-app

Web interface (and later the phone app) for the smart home backend (`../smarthome-backend`). TypeScript, npm workspaces:

```
apps/web               React + Vite: login, account setup, devices by room, live state, confirmations
packages/api-client    typed client, generated from the backend's OpenAPI description, plus live event types
packages/core          logic shared with the future Expo app: device capabilities → controls, live events → lists
```

`apps/mobile` (Expo) comes later and uses `api-client` and `core` as well. npm workspaces instead of pnpm: npm is there anyway and is enough for a handful of packages.

## Start locally

Needs Node 22+ and the local stack from `../homeserver-infra` (Kratos, Postgres, Mosquitto, backend):

```bash
cd ../homeserver-infra && docker compose up -d kratos smarthome-db mosquitto smarthome-backend
cd ../smarthome-backend && ./gradlew :simulator:run     # simulated Zigbee devices (own terminal)
cd ../smarthome-app && npm install && npm run dev        # http://localhost:5173
```

The dev server proxies `/api` (including the `/api/events` WebSocket) to the backend (`BACKEND_URL`, default `http://localhost:8088`) and `/kratos` to Kratos (`KRATOS_URL`, default `http://localhost:4433`). Everything runs on one origin, so there is no CORS and Kratos's session cookie belongs to the web interface. On the server a reverse proxy (e.g. Caddy) does the same: web files, `/api` → backend, `/kratos` → Kratos public API.

Accounts are created by an admin (`POST /api/users` in the backend); the setup link points to `/setup?flow=…` of this interface (Kratos `recovery.ui_url`). There the person enters the code and chooses a password.

## Login

Browser flows of Ory Kratos as a single-page app (JSON requests with cookies, see `apps/web/src/auth/kratos.ts`):

1. Login with email or username and password; with TOTP set up, the second factor (code or backup code) follows.
2. `GET /sessions/whoami?tokenize_as=smarthome` returns a JWT (5 minutes) for the backend. It is kept in memory only and fetched again 30 seconds before it expires.
3. Live updates: `POST /api/events/ticket`, then `ws(s)://<host>/api/events?ticket=…`. After every (re)connect the state is loaded again via REST.

Approving with Face ID needs the phone app; in the web interface another person (or an admin) approves.

## Commands

```bash
npm run dev          # web interface with hot reload
npm run check        # typecheck, lint, tests (Vitest)
npm run build        # production build to apps/web/dist
npm run api:update   # new API client: first `./gradlew test --tests '*OpenApiExportTest'` in smarthome-backend,
                     # or OPENAPI_URL=http://localhost:8088/v3/api-docs npm run api:update
```
