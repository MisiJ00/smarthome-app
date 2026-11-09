// Test clients for SSO with Hydra, for the LOCAL development stack only.
//
//   npm run dev:oauth
//
// Creates (or updates) two public OAuth2 clients (PKCE, no secret) at the local Hydra, through the Docker network
// because Hydra's admin API is not published:
//   dev-sso-client   "Dev-Testdienst"                     asks for consent
//   dev-sso-trusted  "Dev-Testdienst (vertrauenswürdig)"  metadata.trusted = true, skips the consent page
// Redirect address http://localhost:9876/callback (nothing listens there, the browser only has to reach it).
// Refuses to run unless Hydra's public address is localhost: production never has test clients, there clients are
// registered by hand with the Hydra CLI (docs in homeserver-infra/auth/README.md).
import { hydraAdmin as admin } from './hydra-admin.mjs';
import { isLocal } from './local-only.mjs';

const HYDRA = process.env.HYDRA_URL ?? 'http://localhost:4444';
if (!isLocal(HYDRA)) {
  console.error(`Refusing to create test clients for ${HYDRA}: only for the local development stack.`);
  process.exit(1);
}

const clients = [
  { id: 'dev-sso-client', name: 'Dev-Testdienst', trusted: false },
  { id: 'dev-sso-trusted', name: 'Dev-Testdienst (vertrauenswürdig)', trusted: true },
];

for (const client of clients) {
  const body = {
    client_id: client.id,
    client_name: client.name,
    redirect_uris: ['http://localhost:9876/callback'],
    post_logout_redirect_uris: ['http://localhost:9876/logged-out'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'openid profile email offline_access',
    token_endpoint_auth_method: 'none',
    metadata: { trusted: client.trusted },
  };
  const exists = admin('GET', `/admin/clients/${client.id}`).status === 200;
  const result = exists ? admin('PUT', `/admin/clients/${client.id}`, body) : admin('POST', '/admin/clients', body);
  if (result.status >= 300) {
    console.error(`Could not set up ${client.id} (${result.status}): ${result.body}`);
    process.exit(1);
  }
  console.log(`${exists ? 'Updated' : 'Created'} ${client.id}`);
}
console.log('Done. Try: npm run e2e:oauth');
