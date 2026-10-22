// Native API flows of Ory Kratos: no cookies, the app keeps a session token (X-Session-Token) instead.

export interface UiText {
  id: number;
  text: string;
  type: 'info' | 'error' | 'success';
}

interface Flow {
  id: string;
  ui: { messages?: UiText[]; nodes: Array<{ messages?: UiText[] }> };
}

export interface Session {
  id: string;
  identity: { id: string; traits: { email?: string; username?: string; name?: string } };
  tokenized?: string;
}

export class KratosError extends Error {
  constructor(
    readonly status: number,
    readonly id: string | undefined,
    message: string,
    readonly messages: UiText[] = [],
  ) {
    super(message);
  }
}

// Kratos answers in English; the usual messages in German.
const GERMAN: Record<number, string> = {
  4000006: 'E-Mail, Benutzername oder Passwort stimmt nicht.',
  4000008: 'Der Code stimmt nicht.',
  4010001: 'Die Anmeldung hat zu lange gedauert. Bitte noch einmal.',
};

export function german(message: UiText): string {
  return GERMAN[message.id] ?? message.text;
}

async function call<T>(server: string, path: string, init: RequestInit & { sessionToken?: string } = {}): Promise<{ status: number; body: T }> {
  const { sessionToken, ...rest } = init;
  const response = await fetch(`${server}/kratos${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
    },
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
}

function errorOf(status: number, body: unknown): KratosError {
  const error = (body as { error?: { id?: string; reason?: string; message?: string } } | undefined)?.error;
  const flow = body as Flow | undefined;
  const messages = flow?.ui ? [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((n) => n.messages ?? [])] : [];
  const first = messages.find((m) => m.type === 'error');
  return new KratosError(status, error?.id, first ? german(first) : (error?.reason ?? error?.message ?? `Fehler ${status}`), messages);
}

async function submitLogin(server: string, values: Record<string, unknown>, aal2SessionToken?: string) {
  const query = aal2SessionToken ? '?aal=aal2' : '';
  const flow = await call<Flow>(server, `/self-service/login/api${query}`, aal2SessionToken ? { sessionToken: aal2SessionToken } : {});
  if (flow.status !== 200) {
    throw errorOf(flow.status, flow.body);
  }
  const result = await call<{ session_token?: string; session: Session }>(server, `/self-service/login?flow=${flow.body.id}`, {
    method: 'POST',
    body: JSON.stringify(values),
    ...(aal2SessionToken ? { sessionToken: aal2SessionToken } : {}),
  });
  if (result.status !== 200) {
    throw errorOf(result.status, result.body);
  }
  return result.body;
}

/** Password login; returns the session token. With TOTP set up, {@link secondFactor} has to follow. */
export async function login(server: string, identifier: string, password: string): Promise<string> {
  const result = await submitLogin(server, { method: 'password', identifier, password });
  if (!result.session_token) {
    throw new KratosError(500, undefined, 'Kratos hat kein Session-Token geliefert.');
  }
  return result.session_token;
}

/** Upgrades the session with a TOTP code or a backup code. */
export async function secondFactor(server: string, sessionToken: string, code: string, backupCode: boolean): Promise<void> {
  await submitLogin(
    server,
    backupCode ? { method: 'lookup_secret', lookup_secret: code } : { method: 'totp', totp_code: code },
    sessionToken,
  );
}

/**
 * The session with a short-lived JWT for the backend. Null if the token is no longer valid; throws with id
 * "session_aal2_required" when the second factor is missing.
 */
export async function whoami(server: string, sessionToken: string): Promise<Session | null> {
  const { status, body } = await call<Session>(server, '/sessions/whoami?tokenize_as=smarthome', { sessionToken });
  if (status === 200) {
    return body;
  }
  if (status === 401) {
    return null;
  }
  throw errorOf(status, body);
}

export async function logout(server: string, sessionToken: string): Promise<void> {
  await call(server, '/self-service/logout/api', { method: 'DELETE', body: JSON.stringify({ session_token: sessionToken }) });
}

/** Seconds since epoch until which the JWT is valid. */
export function jwtExpiry(jwt: string): number {
  const payload = (jwt.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return (JSON.parse(atob(padded)) as { exp?: number }).exp ?? 0;
}
