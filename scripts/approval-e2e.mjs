// End-to-end check of door approvals with a browser passkey against the LOCAL stack (Kratos :4433, backend :8088,
// web interface :5173, e.g. `npm run dev`; seeded with `npm run dev:seed`, simulator not needed).
//
//   npm run e2e:approval
//
// Chrome headless with a virtual platform authenticator: sign in -> set up this browser for approvals in the account
// page -> the test account asks to unlock the front door -> approve it in the browser with one gesture -> check the
// backend says approved -> remove the browser again. Uses the local test account; refuses anything but localhost.
import { backendToken, devCredentials, requireLocal, sleep, startBrowser } from './browser-driver.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const KRATOS = process.env.KRATOS_URL ?? 'http://localhost:4433';
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8088';
requireLocal(WEB, KRATOS, BACKEND);
const credentials = devCredentials();
const identifier = credentials.DEV_RESIDENT_IDENTIFIER;
const password = credentials.DEV_RESIDENT_PASSWORD;
if (!identifier || !password) {
  console.error('No DEV_RESIDENT_* in .dev-credentials: run `npm run dev:seed` first.');
  process.exit(1);
}
const step = (text) => console.log(`- ${text}`);

async function api(method, path, body) {
  const token = await backendToken(KRATOS, identifier, password);
  const response = await fetch(BACKEND + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const browser = await startBrowser(WEB);
let failed = false;
try {
  const { goto, fill, click, waitFor, pageText, evaluate } = browser;
  const authenticator = await browser.addAuthenticator();
  const sectionButton = (label) =>
    evaluate(`(() => {
      const s = document.querySelector('[aria-labelledby="approval-title"]');
      const b = s && [...s.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(label)});
      if (b) b.click();
      return Boolean(b);
    })()`);

  const door = (await api('GET', '/api/devices')).body.find((d) => d.type === 'lock');
  if (!door) {
    throw new Error('No lock in the local backend (npm run dev:seed with the simulator running).');
  }

  step('sign in with password');
  await goto('/login');
  await fill('input[autocomplete=username]', identifier);
  await fill('input[type=password]', password);
  await click('Anmelden');
  await waitFor('home page', async () => (await evaluate('location.pathname')) === '/');

  step('set up this browser for approvals');
  await goto('/account');
  await waitFor('approval section', async () => (await pageText()).includes('Diesen Browser für Freigaben einrichten'));
  await sectionButton('Diesen Browser für Freigaben einrichten');
  await waitFor('browser in the list', async () => (await pageText()).includes('Dieser Browser ·'));
  const registered = (await api('GET', '/api/me/trusted-devices')).body.filter((d) => d.kind === 'webauthn' && d.active);
  if (registered.length !== 1) {
    throw new Error(`Expected one active browser passkey, found ${registered.length}`);
  }

  step('ask to unlock the front door');
  const asked = await api('POST', `/api/devices/${door.id}/commands`, { state: 'UNLOCK' });
  if (asked.body?.status !== 'confirmation_required') {
    throw new Error(`Expected a confirmation, got ${JSON.stringify(asked.body)} (is unlocking allowed for this device?)`);
  }
  const confirmationId = asked.body.confirmationId;

  step('approve it in the browser with one gesture');
  await goto('/');
  await waitFor('approve button', async () => (await pageText()).includes('Mit Passkey freigeben'));
  await click('Mit Passkey freigeben');
  let status = 'pending';
  for (let i = 0; i < 20 && status === 'pending'; i++) {
    await sleep(500);
    status = (await api('GET', `/api/confirmations/${confirmationId}`)).body.status;
  }
  if (status !== 'approved') {
    throw new Error(`The request should be approved, it is ${status}. Page says: ${(await pageText()).slice(0, 300)}`);
  }
  const used = (await api('GET', '/api/me/trusted-devices')).body.find((d) => d.kind === 'webauthn' && d.active);
  if (!used?.lastUsed) {
    throw new Error('lastUsed should be set after the approval');
  }
  if ((await authenticator.credentials()).length !== 1) {
    throw new Error('The authenticator should hold exactly one credential');
  }

  step('remove the browser again');
  await goto('/account');
  await waitFor('browser in the list', async () => (await pageText()).includes('Dieser Browser ·'));
  await sectionButton('Entfernen');
  await waitFor('empty list', async () => !(await pageText()).includes('Dieser Browser ·'));
  console.log('OK: browser passkey registration and approval work.');
} catch (error) {
  failed = true;
  console.error(`FAILED: ${error.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
