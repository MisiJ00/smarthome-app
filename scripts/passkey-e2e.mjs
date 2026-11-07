// End-to-end check of passkeys against the LOCAL stack (Kratos on :4433, web interface on :5173, e.g. `npm run dev`).
//
//   npm run e2e:passkey
//
// Drives Chrome headless through the DevTools protocol with a virtual authenticator (no real device needed):
// sign in with password -> add a passkey in the account page -> sign out -> sign in with the passkey -> remove it.
// Uses the local test account from .dev-credentials (npm run dev:seed). Refuses anything but localhost.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isLocal } from './local-only.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
if (!isLocal(WEB)) {
  console.error(`Refusing to run against ${WEB}: only for the local development stack.`);
  process.exit(1);
}
const credentials = Object.fromEntries(
  readFileSync(new URL('../.dev-credentials', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const identifier = credentials.DEV_RESIDENT_IDENTIFIER;
const password = credentials.DEV_RESIDENT_PASSWORD;
if (!identifier || !password) {
  console.error('No DEV_RESIDENT_* in .dev-credentials: run `npm run dev:seed` first.');
  process.exit(1);
}

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/opt/pw-browsers/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));
if (!chromePath) {
  console.error('No Chrome or Edge found; set CHROME_PATH.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'passkey-e2e-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(
  chromePath,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-sandbox', 'about:blank'],
  { stdio: 'ignore' },
);

let ws;
let nextId = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) {
    throw new Error(JSON.stringify(r.result.exceptionDetails));
  }
  return r.result.result.value;
};
const pageText = () => evaluate('document.body.innerText');
const goto = async (path) => {
  await send('Page.navigate', { url: WEB + path });
  await sleep(2000);
};
const fill = (selector, value) =>
  evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)});
    e.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
const click = (label) =>
  evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(label)});
    if (b) b.click();
    return Boolean(b);
  })()`);
const waitFor = async (what, check, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) {
      return;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for: ${what}\nPage says: ${(await pageText()).slice(0, 300)}`);
};
const step = (text) => console.log(`- ${text}`);

let failed = false;
try {
  let targets;
  for (let i = 0; i < 40 && !targets; i++) {
    targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json(), () => undefined);
    await sleep(250);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending.get(d.id)?.(d);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('WebAuthn.enable');
  const authenticatorId = (
    await send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    })
  ).result.authenticatorId;
  const stored = async () => (await send('WebAuthn.getCredentials', { authenticatorId })).result.credentials.length;

  step('sign in with password');
  await goto('/login');
  await fill('input[autocomplete=username]', identifier);
  await fill('input[type=password]', password);
  await click('Anmelden');
  await waitFor('home page', async () => (await evaluate('location.pathname')) === '/');

  step('add a passkey in the account page');
  await goto('/account');
  await waitFor('passkey section', async () => (await pageText()).includes('Passkey hinzufügen'));
  const before = (await pageText()).split('hinzugefügt am').length - 1;
  await click('Passkey hinzufügen');
  await waitFor('new passkey in the list', async () => (await pageText()).split('hinzugefügt am').length - 1 === before + 1);
  if ((await stored()) !== 1) {
    throw new Error('The authenticator should hold exactly one credential');
  }

  step('sign out');
  await evaluate(`fetch('/kratos/self-service/logout/browser', { credentials: 'include' }).then((r) => r.json()).then((j) => fetch('/kratos/self-service/logout?token=' + j.logout_token, { credentials: 'include' }))`);
  await goto('/login');
  await waitFor('login page', async () => (await pageText()).includes('Mit Passkey anmelden'));

  step('sign in with the passkey');
  await click('Mit Passkey anmelden');
  await waitFor('home page', async () => (await evaluate('location.pathname')) === '/');

  step('remove the passkey again');
  await goto('/account');
  await waitFor('passkey list', async () => (await pageText()).includes('hinzugefügt am'));
  await click('Entfernen');
  await waitFor('empty list', async () => (await pageText()).split('hinzugefügt am').length - 1 === before);
  console.log('OK: passkey registration, sign-in and removal work.');
} catch (error) {
  failed = true;
  console.error(`FAILED: ${error.message}`);
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
process.exit(failed ? 1 : 0);
