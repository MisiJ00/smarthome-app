// End-to-end check of passkeys against the LOCAL stack (Kratos on :4433, web interface on :5173, e.g. `npm run dev`).
//
//   npm run e2e:passkey
//
// Drives Chrome headless through the DevTools protocol with a virtual authenticator (no real device needed):
// sign in with password -> add a passkey in the account page -> sign out -> sign in with the passkey -> remove it.
// Uses the local test account from .dev-credentials (npm run dev:seed). Refuses anything but localhost.
import { devCredentials, requireLocal, startBrowser } from './browser-driver.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
requireLocal(WEB);
const credentials = devCredentials();
const identifier = credentials.DEV_RESIDENT_IDENTIFIER;
const password = credentials.DEV_RESIDENT_PASSWORD;
if (!identifier || !password) {
  console.error('No DEV_RESIDENT_* in .dev-credentials: run `npm run dev:seed` first.');
  process.exit(1);
}
const step = (text) => console.log(`- ${text}`);

const browser = await startBrowser(WEB);
let failed = false;
try {
  const { goto, fill, click, waitFor, pageText, evaluate } = browser;
  const authenticator = await browser.addAuthenticator();
  const count = async () => (await pageText()).split('hinzugefügt am').length - 1;

  step('sign in with password');
  await goto('/login');
  await fill('input[autocomplete=username]', identifier);
  await fill('input[type=password]', password);
  await click('Anmelden');
  await waitFor('home page', async () => (await evaluate('location.pathname')) === '/');

  step('add a passkey in the account page');
  await goto('/account');
  await waitFor('passkey section', async () => (await pageText()).includes('Passkey hinzufügen'));
  const before = await count();
  await click('Passkey hinzufügen');
  await waitFor('new passkey in the list', async () => (await count()) === before + 1);
  if ((await authenticator.credentials()).length !== 1) {
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
  await waitFor('empty list', async () => (await count()) === before);
  console.log('OK: passkey registration, sign-in and removal work.');
} catch (error) {
  failed = true;
  console.error(`FAILED: ${error.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
