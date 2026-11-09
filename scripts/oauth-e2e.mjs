// End-to-end check of SSO with Hydra against the LOCAL stack (Kratos :4433, Hydra :4444, backend :8088, web interface
// :5173 e.g. `npm run dev`; `npm run dev:seed` and `npm run dev:oauth` first). Chrome headless plays the browser.
//
//   npm run e2e:oauth
//
// 1. Untrusted service: Hydra -> sign in with Kratos -> consent page -> allow -> authorization code (PKCE) -> token,
//    ID token carries the Kratos identity id, name and e-mail.
// 2. Trusted service in the same browser: no sign-in and no consent page, straight to the code.
// 3. Consent refused: the service gets error=access_denied, no code.
// 4. Logout page of a service: confirm -> back to the service, the Kratos session of the browser is over.
// 5. Sign-in with a passkey on the sign-in page of another service (virtual authenticator).
// 6. The audit log: every step above is in it (service, scopes, result, reasons) and holds no code, token or challenge;
//    the web interface's log page shows the entries in German and the "Vorgang" filter finds them.
// Uses the local test accounts; refuses anything but localhost.
import { createHash, randomBytes } from 'node:crypto';

import { backendToken, devCredentials, requireLocal, sleep, startBrowser } from './browser-driver.mjs';
import { hydraAdmin } from './hydra-admin.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const KRATOS = process.env.KRATOS_URL ?? 'http://localhost:4433';
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8088';
const HYDRA = process.env.HYDRA_URL ?? 'http://localhost:4444';
requireLocal(WEB, KRATOS, BACKEND, HYDRA);
const credentials = devCredentials();
const identifier = credentials.DEV_RESIDENT_IDENTIFIER;
const password = credentials.DEV_RESIDENT_PASSWORD;
if (!identifier || !password) {
  console.error('No DEV_RESIDENT_* in .dev-credentials: run `npm run dev:seed` first.');
  process.exit(1);
}
const step = (text) => console.log(`- ${text}`);
const startedAt = new Date().toISOString();
/** With SCREENSHOT_DIR set, the pages are saved as PNG for the docs. */
const SHOTS = process.env.SCREENSHOT_DIR;
const REDIRECT = 'http://localhost:9876/callback';
const b64url = (buffer) => Buffer.from(buffer).toString('base64url');
const claimsOf = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

/** A fresh PKCE pair and the authorization URL of a client. */
function authorization(clientId, scope = 'openid profile email') {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(12));
  const url =
    `${HYDRA}/oauth2/auth?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scope)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
  return { clientId, verifier, state, url };
}

async function exchange(request, code) {
  const response = await fetch(`${HYDRA}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: request.clientId, code_verifier: request.verifier }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Token request failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

const browser = await startBrowser(WEB);
let failed = false;
try {
  const { goto, fill, click, waitFor, pageText, evaluate, send } = browser;
  await send('Network.enable');
  /** Addresses the browser tried to open at the (nonexistent) service, in order. */
  const callbacks = [];
  browser.onEvent((method, params) => {
    if (method === 'Network.requestWillBeSent' && params.request.url.startsWith('http://localhost:9876/')) {
      callbacks.push(new URL(params.request.url));
    }
  });
  const open = async (url) => {
    callbacks.length = 0;
    await send('Page.navigate', { url });
  };
  const callback = async (what) => {
    await waitFor(what, async () => callbacks.length > 0, 15000);
    return callbacks[0];
  };

  const jwt = await backendToken(KRATOS, identifier, password);
  const identity = claimsOf(jwt);

  // 1. Untrusted service
  step('untrusted service: sign in with Kratos');
  const first = authorization('dev-sso-client');
  await open(first.url);
  await waitFor('Kratos login form', async () => (await pageText()).includes('E-Mail oder Benutzername'));
  if (!(await pageText()).includes('anderen Dienst')) {
    throw new Error('The login page should say that the sign-in is for another service');
  }
  if (SHOTS) {
    await browser.screenshot(`${SHOTS}/i-01-sso-login.png`);
  }
  await fill('input[autocomplete=username]', identifier);
  await fill('input[type=password]', password);
  await click('Anmelden');

  step('untrusted service: consent page shows the service and the scopes, allow');
  await waitFor('consent page', async () => (await pageText()).includes('möchte sich mit deinem Konto anmelden'));
  const consent = await pageText();
  for (const text of ['Dev-Testdienst', 'Dich erkennen', 'Name und Benutzername', 'E-Mail-Adresse']) {
    if (!consent.includes(text)) {
      throw new Error(`The consent page should show "${text}". Page says: ${consent.slice(0, 300)}`);
    }
  }
  if (SHOTS) {
    await browser.screenshot(`${SHOTS}/i-02-sso-consent.png`);
  }
  await click('Erlauben');
  const granted = await callback('callback with code');
  if (granted.searchParams.get('state') !== first.state || !granted.searchParams.get('code')) {
    throw new Error(`Unexpected callback ${granted.href}`);
  }
  const token = await exchange(first, granted.searchParams.get('code'));
  const idToken = claimsOf(token.id_token);
  if (idToken.sub !== identity.sub) {
    throw new Error(`The ID token's sub should be the Kratos identity id (${identity.sub}), it is ${idToken.sub}`);
  }
  if (!idToken.email || !idToken.name || !idToken.preferred_username) {
    throw new Error(`The ID token should carry name, username and e-mail: ${JSON.stringify(idToken)}`);
  }

  // 2. Trusted service, same browser (Kratos session exists)
  step('trusted service: no consent page, straight to the code');
  const second = authorization('dev-sso-trusted');
  await open(second.url);
  const direct = await callback('callback of the trusted service');
  if (!direct.searchParams.get('code')) {
    throw new Error(`The trusted service should get a code, got ${direct.href}`);
  }
  if ((await pageText()).includes('möchte sich mit deinem Konto anmelden')) {
    throw new Error('A trusted service must not show the consent page');
  }
  const trustedToken = await exchange(second, direct.searchParams.get('code'));
  if (claimsOf(trustedToken.id_token).sub !== identity.sub) {
    throw new Error('The trusted service should get the same identity');
  }

  // 3. Consent refused
  step('consent refused: the service gets access_denied');
  const third = authorization('dev-sso-client');
  await open(third.url);
  await waitFor('consent page', async () => (await pageText()).includes('möchte sich mit deinem Konto anmelden'));
  await click('Ablehnen');
  const refused = await callback('callback with an error');
  if (refused.searchParams.get('error') !== 'access_denied' || refused.searchParams.get('code')) {
    throw new Error(`Refusing should give error=access_denied and no code, got ${refused.href}`);
  }

  // 4. Logout page: Hydra only has a logout to ask for where a session exists, so make one the way another setup of
  // Hydra could (remember the login), get the logout challenge and open the page in the signed-in browser
  step('logout page: confirm, back to the service, Kratos session over');
  const jar = new Map();
  const call = async (url) => {
    const response = await fetch(url, { redirect: 'manual', headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };
  const fourth = authorization('dev-sso-trusted');
  const started = await call(fourth.url);
  const loginChallenge = new URL(started.headers.get('location')).searchParams.get('login_challenge');
  const accepted = hydraAdmin('PUT', `/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`, {
    subject: identity.sub,
    remember: true,
    remember_for: 3600,
  });
  const afterLogin = await call(JSON.parse(accepted.body).redirect_to);
  const consentChallenge = new URL(afterLogin.headers.get('location')).searchParams.get('consent_challenge');
  const consentAnswer = await fetch(`${BACKEND}/api/oauth/consent?challenge=${consentChallenge}`, { headers: { Authorization: `Bearer ${jwt}` } });
  const afterConsent = await call((await consentAnswer.json()).redirectTo);
  const code = new URL(afterConsent.headers.get('location')).searchParams.get('code');
  const logoutToken = await exchange(fourth, code);
  const logoutStart = await call(
    `${HYDRA}/oauth2/sessions/logout?id_token_hint=${logoutToken.id_token}&post_logout_redirect_uri=${encodeURIComponent('http://localhost:9876/logged-out')}&state=bye`,
  );
  const logoutChallenge = new URL(logoutStart.headers.get('location')).searchParams.get('logout_challenge');
  for (const [name, value] of jar) {
    await send('Network.setCookie', { name, value, domain: 'localhost', path: '/' });
  }
  callbacks.length = 0;
  await goto(`/oauth/logout?logout_challenge=${logoutChallenge}`);
  await waitFor('logout page', async () => (await pageText()).includes('möchte dich abmelden'));
  if (!(await pageText()).includes('Dev-Testdienst')) {
    throw new Error('The logout page should name the service');
  }
  if (SHOTS) {
    await browser.screenshot(`${SHOTS}/i-03-sso-logout.png`);
  }
  await click('Abmelden');
  const back = await callback('callback after the logout');
  if (!back.pathname.startsWith('/logged-out')) {
    throw new Error(`The logout should end at the service's post-logout address, got ${back.href}`);
  }
  await sleep(500);
  await goto('/');
  await waitFor('login page (Kratos session over)', async () => (await evaluate('location.pathname')) === '/login');

  // 5. Passkey on the sign-in page of another service
  step('passkey sign-in on the sign-in page of another service');
  await browser.addAuthenticator();
  await goto('/login');
  await fill('input[autocomplete=username]', identifier);
  await fill('input[type=password]', password);
  await click('Anmelden');
  await waitFor('home page', async () => (await evaluate('location.pathname')) === '/');
  await goto('/account');
  await waitFor('passkey section', async () => (await pageText()).includes('Passkey hinzufügen'));
  const passkeys = async () => (await pageText()).split('hinzugefügt am').length - 1;
  const known = await passkeys();
  await click('Passkey hinzufügen');
  await waitFor('new passkey', async () => (await passkeys()) === known + 1);
  const signOut = () =>
    evaluate(`fetch('/kratos/self-service/logout/browser', { credentials: 'include' }).then((r) => r.json()).then((j) => fetch('/kratos/self-service/logout?token=' + j.logout_token, { credentials: 'include' }))`);
  await signOut();
  const fifth = authorization('dev-sso-trusted');
  await open(fifth.url);
  await waitFor('passkey button on the service sign-in page', async () => (await pageText()).includes('Mit Passkey anmelden'));
  await click('Mit Passkey anmelden');
  const viaPasskey = await callback('callback after the passkey sign-in');
  if (!viaPasskey.searchParams.get('code')) {
    throw new Error(`The passkey sign-in should end with a code, got ${viaPasskey.href}`);
  }
  const passkeyToken = await exchange(fifth, viaPasskey.searchParams.get('code'));
  if (claimsOf(passkeyToken.id_token).sub !== identity.sub) {
    throw new Error('The passkey sign-in should give the same identity');
  }
  // Clean up: remove the passkey made here (the newest, last in the list)
  await goto('/account');
  await waitFor('passkey list', async () => (await passkeys()) === known + 1);
  await evaluate(`(() => {
    const section = document.querySelector('[aria-labelledby="passkeys-title"]');
    const buttons = [...section.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Entfernen');
    buttons[buttons.length - 1].click();
  })()`);
  await waitFor('passkey removed', async () => (await passkeys()) === known);
  await signOut();

  // 6. The audit log
  step('audit log: every step is in it, without secrets');
  const adminJwt = await backendToken(KRATOS, credentials.DEV_ADMIN_IDENTIFIER, credentials.DEV_ADMIN_PASSWORD);
  const me = await (await fetch(`${BACKEND}/api/me`, { headers: { Authorization: `Bearer ${jwt}` } })).json();
  const logResponse = await fetch(`${BACKEND}/api/audit?userId=${me.id}&from=${encodeURIComponent(startedAt)}&size=100`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
  });
  const log = await logResponse.json();
  const entries = log.items.filter((e) => e.action.startsWith('sso_'));
  const has = (action, result, clientId, extra = () => true) =>
    entries.some((e) => e.action === action && e.result === result && e.params.clientId === clientId && extra(e));
  const expected = [
    ['sso_login', 'accepted', 'dev-sso-client'],
    ['sso_login', 'accepted', 'dev-sso-trusted'],
    ['sso_consent', 'accepted', 'dev-sso-client', (e) => ['openid', 'profile', 'email'].every((x) => e.params.scopes.includes(x))],
    ['sso_consent', 'skipped', 'dev-sso-trusted', (e) => e.params.reason === 'trusted'],
    ['sso_consent', 'rejected', 'dev-sso-client', (e) => e.params.reason === 'refused'],
    ['sso_logout', 'accepted', 'dev-sso-trusted', (e) => e.userName === me.name],
  ];
  for (const [action, result, clientId, extra] of expected) {
    if (!has(action, result, clientId, extra)) {
      throw new Error(`Audit log is missing ${action}/${result} for ${clientId}: ${JSON.stringify(entries.map((e) => [e.action, e.result, e.params.clientId]))}`);
    }
  }
  if (!entries.every((e) => e.params.clientName && e.via)) {
    throw new Error('Every SSO entry should name the service and the client it came through');
  }
  const secrets = [
    granted.searchParams.get('code'),
    direct.searchParams.get('code'),
    viaPasskey.searchParams.get('code'),
    token.access_token,
    token.id_token,
    trustedToken.access_token,
    passkeyToken.access_token,
    logoutToken.id_token,
    loginChallenge,
    consentChallenge,
    logoutChallenge,
  ];
  const raw = JSON.stringify(entries);
  for (const secret of secrets) {
    if (!secret || raw.includes(secret)) {
      throw new Error('A code, token or challenge must never be in the audit log');
    }
  }

  step('audit log page: German lines and the "Vorgang" filter');
  await goto('/login');
  await fill('input[autocomplete=username]', credentials.DEV_ADMIN_IDENTIFIER);
  await fill('input[type=password]', credentials.DEV_ADMIN_PASSWORD);
  await click('Anmelden');
  await waitFor('home page', async () => (await evaluate('location.pathname')) === '/');
  await goto('/admin/audit');
  await waitFor('log entries', async () => (await pageText()).includes('Anmeldung bei Dev-Testdienst'));
  const setSelect = (label, value) =>
    evaluate(`(() => {
      const e = document.querySelector('select[aria-label="${label}"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(value)});
      e.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  await setSelect('Vorgang', 'sso_consent');
  await waitFor('only consents', async () => {
    const text = await pageText();
    return text.includes('Zustimmung für Dev-Testdienst') && !text.includes('Anmeldung bei Dev-Testdienst');
  });
  const logPage = await pageText();
  for (const text of ['erteilt', 'übersprungen', 'vertrauenswürdiger Dienst', 'abgelehnt']) {
    if (!logPage.includes(text)) {
      throw new Error(`The log page should show "${text}". Page says: ${logPage.slice(0, 500)}`);
    }
  }
  if (SHOTS) {
    await setSelect('Vorgang', '');
    await waitFor('all entries again', async () => (await pageText()).includes('Anmeldung bei Dev-Testdienst'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await browser.screenshot(`${SHOTS}/j-01-audit-sso.png`);
  }
  await signOut();

  console.log('OK: SSO with Hydra works (consent, trusted service, refusal, logout, passkey, audit log).');
} catch (error) {
  failed = true;
  console.error(`FAILED: ${error.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
