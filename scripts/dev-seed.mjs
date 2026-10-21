// Test accounts and test data for the LOCAL development stack only.
//
//   npm run dev:seed
//
// Creates (if missing) in the local Kratos and backend:
//   devadmin  (dev-admin@example.invalid)  admin
//   erikadev  (erika-dev@example.invalid)  bewohner
// plus the rooms "Wohnzimmer" and "Flur" with the simulator's devices. Passwords are generated and written to
// .dev-credentials (ignored by git). Refuses to run against anything but localhost: production must never have
// test accounts (there, self-registration is off and accounts are only created by an admin).
//
// The backend has to know devadmin as first admin once:
//   SMARTHOME_INITIAL_ADMIN=dev-admin@example.invalid docker compose up -d smarthome-backend   (in homeserver-infra)
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { isLocal } from './local-only.mjs';

const KRATOS = process.env.KRATOS_URL ?? 'http://localhost:4433';
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8088';
const FILE = new URL('../.dev-credentials', import.meta.url);

for (const url of [KRATOS, BACKEND]) {
  if (!isLocal(url)) {
    console.error(`Refusing to create test accounts on ${url}: only for the local development stack.`);
    process.exit(1);
  }
}

const json = { 'Content-Type': 'application/json', Accept: 'application/json' };
const credentials = existsSync(FILE)
  ? Object.fromEntries(
      readFileSync(FILE, 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => l.split(/=(.*)/s).slice(0, 2)),
    )
  : {};

const accounts = [
  { key: 'DEV_ADMIN', username: 'devadmin', email: 'dev-admin@example.invalid', name: 'Dev Admin' },
  { key: 'DEV_RESIDENT', username: 'erikadev', email: 'erika-dev@example.invalid', name: 'Erika (Test)' },
];

async function kratosLogin(identifier, password) {
  const flow = await (await fetch(`${KRATOS}/self-service/login/api`)).json();
  const response = await fetch(`${KRATOS}/self-service/login?flow=${flow.id}`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ method: 'password', identifier, password }),
  });
  return response.ok ? (await response.json()).session_token : null;
}

async function register(account, password) {
  const flow = await (await fetch(`${KRATOS}/self-service/registration/api`)).json();
  const response = await fetch(`${KRATOS}/self-service/registration?flow=${flow.id}`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ method: 'password', password, traits: { email: account.email, username: account.username, name: account.name } }),
  });
  if (!response.ok) {
    throw new Error(
      `Registering ${account.username} failed (${response.status}). If the account exists already, put its password ` +
        `into .dev-credentials as ${account.key}_PASSWORD or delete the identity; self-registration must be on locally.`,
    );
  }
}

async function jwt(sessionToken) {
  const who = await (await fetch(`${KRATOS}/sessions/whoami?tokenize_as=smarthome`, { headers: { 'X-Session-Token': sessionToken } })).json();
  return who.tokenized;
}

function client(token) {
  return async (method, path, body) => {
    const response = await fetch(BACKEND + path, {
      method,
      headers: { ...json, Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

// Accounts
const sessions = {};
for (const account of accounts) {
  let password = credentials[`${account.key}_PASSWORD`];
  let session = password ? await kratosLogin(account.username, password) : null;
  if (!session) {
    password = `dev-${randomBytes(12).toString('base64url')}`;
    await register(account, password);
    session = await kratosLogin(account.username, password);
    console.log(`Created ${account.username}`);
  }
  credentials[`${account.key}_IDENTIFIER`] = account.username;
  credentials[`${account.key}_PASSWORD`] = password;
  sessions[account.key] = session;
}
writeFileSync(
  FILE,
  '# Local test accounts (npm run dev:seed). Only for the development stack on this machine.\n' +
    Object.entries(credentials)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') +
    '\n',
);

const admin = client(await jwt(sessions.DEV_ADMIN));
const me = await admin('GET', '/api/me');
if (!me.body?.roles?.includes('admin')) {
  console.error(
    'devadmin is not admin yet. Start the backend once with\n' +
      '  SMARTHOME_INITIAL_ADMIN=dev-admin@example.invalid docker compose up -d smarthome-backend\n' +
      'in homeserver-infra and run npm run dev:seed again.',
  );
  process.exit(1);
}

// Resident: signing in creates the user in the backend, then the admin gives the role
const resident = client(await jwt(sessions.DEV_RESIDENT));
const residentId = (await resident('GET', '/api/me')).body.id;
await admin('PUT', `/api/users/${residentId}/roles`, { roles: ['bewohner'] });

// Rooms and the simulator's devices
const rooms = Object.fromEntries((await admin('GET', '/api/rooms')).body.map((r) => [r.name, r.id]));
for (const name of ['Wohnzimmer', 'Flur']) {
  if (!rooms[name]) {
    rooms[name] = (await admin('POST', '/api/rooms', { name })).body.id;
  }
}
const place = { 'Wohnzimmer Deckenlampe': 'Wohnzimmer', 'Wohnzimmer Heizung': 'Wohnzimmer', Haustuer: 'Flur' };
const discovered = (await admin('GET', '/api/devices/discovered')).body;
for (const device of discovered) {
  const added = await admin('POST', '/api/devices', {
    adapter: device.adapter,
    externalId: device.externalId,
    name: device.suggestedName.replace('Haustuer', 'Haustür'),
    roomId: rooms[place[device.suggestedName]] ?? null,
  });
  if (device.suggestedName === 'Server Steckdose') {
    await admin('PATCH', `/api/devices/${added.body.id}`, { lockedActions: ['switch_off'] });
  }
  console.log(`Added ${device.suggestedName}`);
}
if (discovered.length === 0) {
  console.log('No new devices (is the simulator running? ./gradlew :simulator:run in smarthome-backend)');
}
console.log('Done. Credentials in .dev-credentials');
