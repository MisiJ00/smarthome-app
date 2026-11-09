# smarthome-app

Web interface and Android app for the smart home backend (`../smarthome-backend`). TypeScript, npm workspaces:

```
apps/web               React + Vite: login, account setup, devices by room, live state, confirmations, admin area
apps/mobile            Expo (Android): login, devices by room, live state, confirmations, approval by fingerprint
packages/api-client    typed client, generated from the backend's OpenAPI description, plus live event types
packages/core          logic shared by web and app: device capabilities → controls, live events → lists
packages/theme         design tokens (colours light/dark, spacing, radii, type sizes, icon names) for both
```

Web and app look alike because both take their values from `packages/theme`: the web gets them as CSS variables (`--accent`, `--space-md`, `--font-lg`, …), the app as numbers and colours. Buttons are called the same in both (`primary`, `ghost`, `danger`). npm workspaces instead of pnpm: npm is there anyway and is enough for a handful of packages.

## Start locally

Needs Node 22+ and the local stack from `../homeserver-infra` (Kratos, Postgres, Mosquitto, backend):

```bash
cd ../homeserver-infra && docker compose up -d kratos smarthome-db mosquitto smarthome-backend
cd ../smarthome-backend && MQTT_USER=simulator MQTT_PASSWORD=<MQTT_SIMULATOR_PASSWORD aus homeserver-infra/.env> \
  ./gradlew :simulator:run                                # simulated Zigbee devices (own terminal)
cd ../smarthome-app && npm install && npm run dev        # http://localhost:5173
```

The dev server proxies `/api` (including the `/api/events` WebSocket) to the backend (`BACKEND_URL`, default `http://localhost:8088`) and `/kratos` to Kratos (`KRATOS_URL`, default `http://localhost:4433`). Everything runs on one origin, so there is no CORS and Kratos's session cookie belongs to the web interface. On the server a reverse proxy (e.g. Caddy) does the same: web files, `/api` → backend, `/kratos` → Kratos public API.

Accounts are created by an admin (`POST /api/users` in the backend); the setup link points to `/setup?flow=…` of this interface (Kratos `recovery.ui_url`). There the person enters the code and chooses a password.

## Test accounts (development only)

```bash
npm run dev:seed
```

creates in the **local** Kratos and backend: `devadmin` (admin) and `erikadev` (bewohner), the rooms "Wohnzimmer" and "Flur" and the simulator's devices. Passwords are generated and written to `.dev-credentials` (ignored by git). The script refuses to run against anything but localhost (`scripts/local-only.mjs`, tested). The backend has to accept `devadmin` as first admin once: `SMARTHOME_INITIAL_ADMIN=dev-admin@example.invalid docker compose up -d smarthome-backend` in `homeserver-infra`, then start it normally again.

**Production never has test accounts:** nothing in the backend, the migrations or the configuration creates any; there, self-registration is off (`KRATOS_REGISTRATION_ENABLED=false`) and accounts are only created by an admin.

## Sign-in for other services (SSO with Hydra)

Immich, Nextcloud and the like can sign people in with their account here through Ory Hydra (OpenID Connect); Kratos stays the login. Hydra sends the browser to three pages of the web interface: `/oauth/login` (the usual Kratos sign-in, password plus second factor or passkey, then the backend answers Hydra with the person's own JWT), `/oauth/consent` (which service asks for what; skipped for own services marked as trusted) and `/oauth/logout` (confirm, also ends the Kratos session). All texts are German. Setup and security notes: `homeserver-infra/auth/README.md`. Locally `npm run dev:oauth` creates two test clients (localhost only) and `npm run e2e:oauth` runs the whole flow in headless Chrome (authorization code with PKCE, consent, trusted service, refusal, logout; the passkey sign-in on the service's login page, and the audit log entries; `SCREENSHOT_DIR=docs/screenshots/app-v2` saves the pages, `i-*.png`, `j-*.png`). Every sign-in, consent (given, refused, skipped for a trusted service) and logout is in the audit log (Protokoll in the web interface and the app, filter "Vorgang"), without codes, tokens or challenges.

## Admin area

`/admin`, only visible to admins (the backend checks every request anyway):

- **Geräte:** pairing mode with countdown, newly found devices appear live and are added with name and room; edit name, room and locked actions; remove.
- **Räume:** create, rename, sort (drag and drop or arrows), delete (only empty rooms).
- **Benutzer:** create accounts and show the setup link and code once, new setup code, roles, deactivate, delete; per user own rights, effective rights per device and the registered phones (revoke).
- **Rollen & Rechte:** rights of each role (with or without approval), own roles.
- **Protokoll:** audit log with filters and pages.

## Login

Browser flows of Ory Kratos as a single-page app (JSON requests with cookies, see `apps/web/src/auth/kratos.ts`):

1. Login with email or username and password; with TOTP set up, the second factor (code or backup code) follows.
2. `GET /sessions/whoami?tokenize_as=smarthome` returns a JWT (5 minutes) for the backend. It is kept in memory only and fetched again 30 seconds before it expires.
3. Live updates: `POST /api/events/ticket`, then `ws(s)://<host>/api/events?ticket=…`. After every (re)connect the state is loaded again via REST.

## Appearance

Under "Darstellung" (web `/appearance`, app: settings) each person picks a colour world (`klassik`, `neon`, `sunset`, `lime`, `ozean`, `bubblegum` or own colours), a mode (System / Hell / Dunkel / Schwarz) and a style (kräftig = gradients and glow, ruhig = tinted surfaces). The choice is stored locally on the device: web in `localStorage` (`smarthome.appearance`), app in AsyncStorage.

## Dashboard

The home screen is a grid of tiles in the sizes S, M and L. A tap switches the device; long press (app) or right click (web) opens the options of the device. "Bearbeiten" changes order, size and visibility of the tiles and which devices appear in the widget. The layout is stored per user and device (web `localStorage`, app AsyncStorage) under `smarthome.layout.<userId>`; it is not synced to the server.

## Front door

Opening the front door needs the confirmation of the person who asks: they tap "Wirklich öffnen?" and approve with fingerprint / Face ID in the app (signed with the key of the registered phone). Admins cannot approve a request from a person (`403 confirmation.person_request`). A request from the AI assistant is approved by a person who has the right to do so.

There are no notifications (no push, no ntfy): open requests are shown in the app and web interface while they are open.

## Android app (apps/mobile)

Expo SDK 58 with a local native module (`modules/device-key`): a P-256 key in the Android Keystore that only signs after a fingerprint, for approving requests (`/api/confirmations/{id}/challenge` and `/approve`). The app talks to one server address that serves `/api` and `/kratos` (locally the Vite dev server, later Caddy); in the emulator that is `http://10.0.2.2:5173`. Sign-in uses Kratos's native API flow (session token in the Keystore-backed SecureStore, JWT only in memory). New accounts are set up via the web page from the admin's link. Admins find the same management in the app under Settings (Räume, Geräte einrichten, Benutzer with setup code, Rollen und Rechte, Protokoll); the hooks are shared with the web interface (`packages/core/src/userAdmin.ts`). Tested in the emulator (`docs/screenshots/app-v2/h-*.png`).

**Widget "Schnellschalter":** home screen widget (2x2 to 4x2) with up to 4 devices chosen in the dashboard's edit mode. A tap switches the device without opening the app (own session from SecureStore, colours of the chosen colour world); without sign-in it shows "In der App anmelden". Tested in the emulator (API 35, release build): it draws, a tap switches without the app (audit entry `via: widget`), the door tile only opens the app, light and dark follow the system when the app's mode is "System", and without a login it shows the sign-in hint (`docs/screenshots/app-v2/f-*.png`). It needs about 180 dp of height for three or four devices. Release builds keep WorkManager and Room classes (`extraProguardRules` in `app.json`): without them R8 removes classes WorkManager loads by name and the app crashes at start.

**Emulator:** the app reaches the dev server at `10.0.2.2`, so the web dev server must listen on the loopback address that adb forwards: `npm run dev -w @smarthome/web -- --host 127.0.0.1`. Screenshots of the emulator: `adb emu screenrecord screenshot <folder>`.

Build an APK without an Expo account (needs JDK 21 and the Android SDK, `ANDROID_HOME`):

```bash
cd apps/mobile && npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
# → android/app/build/outputs/apk/release/app-release.apk (signed with the debug key; fine for own phones)
```

On Windows the C++ builds create paths over 260 characters: install CMake 3.31.6 (`sdkmanager "cmake;3.31.6"`, its ninja handles long paths) and have Windows long paths enabled; `plugins/with-short-native-build-dir.js` selects that CMake and builds in `.cxx/` of this repo.

## Commands

```bash
npm run dev          # web interface with hot reload
npm run check        # typecheck, lint, tests (Vitest)
npm run build        # production build to apps/web/dist
npm run api:update   # new API client: first `./gradlew test --tests '*OpenApiExportTest'` in smarthome-backend,
                     # or OPENAPI_URL=http://localhost:8088/v3/api-docs npm run api:update
```
