// A tiny driver for Chrome/Edge headless over the DevTools protocol, for the end-to-end checks against the LOCAL stack.
// No test framework needed: Node 22+ has fetch and WebSocket built in.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isLocal } from './local-only.mjs';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The local test accounts from .dev-credentials (npm run dev:seed). */
export function devCredentials() {
  const file = new URL('../.dev-credentials', import.meta.url);
  if (!existsSync(file)) {
    throw new Error('No .dev-credentials: run `npm run dev:seed` first.');
  }
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
}

/** Refuses anything but localhost: test accounts must never touch another system. */
export function requireLocal(...urls) {
  for (const url of urls) {
    if (!isLocal(url)) {
      throw new Error(`Refusing to run against ${url}: only for the local development stack.`);
    }
  }
}

function findChrome() {
  const found = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/opt/pw-browsers/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p) => p && existsSync(p));
  if (!found) {
    throw new Error('No Chrome or Edge found; set CHROME_PATH.');
  }
  return found;
}

/** Starts a headless browser with one page; {@code base} is the web interface, e.g. http://localhost:5173. */
export async function startBrowser(base) {
  const profile = mkdtempSync(join(tmpdir(), 'smarthome-e2e-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    findChrome(),
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-sandbox', '--window-size=480,900', 'about:blank'],
    { stdio: 'ignore' },
  );
  let targets;
  for (let i = 0; i < 40 && !targets; i++) {
    targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json(), () => undefined);
    await sleep(250);
  }
  if (!targets) {
    chrome.kill();
    throw new Error('The browser did not start.');
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.method) {
      listeners.forEach((listener) => listener(data.method, data.params));
    } else {
      pending.get(data.id)?.(data);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Page.enable');
  await send('Runtime.enable');

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) {
      throw new Error(JSON.stringify(r.result.exceptionDetails));
    }
    return r.result.result.value;
  };
  const pageText = () => evaluate('document.body.innerText');
  const driver = {
    send,
    /** Saves a PNG of the page (phone-sized when {@code mobile}) to {@code file}. */
    async screenshot(file) {
      mkdirSync(join(file, '..'), { recursive: true });
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    /** Calls back for every DevTools event, e.g. Network.requestWillBeSent. */
    onEvent: (listener) => listeners.push(listener),
    evaluate,
    pageText,
    async goto(path) {
      await send('Page.navigate', { url: base + path });
      await sleep(2000);
    },
    fill: (selector, value) =>
      evaluate(`(() => {
        const e = document.querySelector(${JSON.stringify(selector)});
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)});
        e.dispatchEvent(new Event('input', { bubbles: true }));
      })()`),
    /** Clicks the first button with exactly this text; false if there is none. */
    click: (label) =>
      evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(label)});
        if (b) b.click();
        return Boolean(b);
      })()`),
    async waitFor(what, check, ms = 8000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await check()) {
          return;
        }
        await sleep(250);
      }
      throw new Error(`Timed out waiting for: ${what}\nPage says: ${(await pageText()).slice(0, 400)}`);
    },
    /** A platform authenticator that always verifies the user, like a fingerprint reader that always matches. */
    async addAuthenticator() {
      await send('WebAuthn.enable');
      const id = (
        await send('WebAuthn.addVirtualAuthenticator', {
          options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
          },
        })
      ).result.authenticatorId;
      return { id, credentials: async () => (await send('WebAuthn.getCredentials', { authenticatorId: id })).result.credentials };
    },
    async close() {
      chrome.kill();
      await sleep(500);
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    },
  };
  return driver;
}

/** Signs in with the local test account through Kratos's API flow; returns a short-lived JWT for the backend. */
export async function backendToken(kratos, identifier, password) {
  const json = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const flow = await (await fetch(`${kratos}/self-service/login/api`)).json();
  const login = await (
    await fetch(`${kratos}/self-service/login?flow=${flow.id}`, { method: 'POST', headers: json, body: JSON.stringify({ method: 'password', identifier, password }) })
  ).json();
  const who = await (await fetch(`${kratos}/sessions/whoami?tokenize_as=smarthome`, { headers: { 'X-Session-Token': login.session_token } })).json();
  return who.tokenized;
}
