// Browser flows of Ory Kratos, as a single-page app: every request asks for JSON and carries Kratos's cookies
// (session and CSRF). Kratos is reached through the web interface's own origin under /kratos.

const BASE = '/kratos';

export type FlowKind = 'login' | 'recovery' | 'settings';

export interface UiText {
  id: number;
  text: string;
  type: 'info' | 'error' | 'success';
}

interface UiNode {
  attributes: { name?: string; value?: unknown; node_type?: string };
  messages?: UiText[];
  group?: string;
}

export interface Flow {
  id: string;
  state?: string;
  ui: { nodes: UiNode[]; messages?: UiText[] };
}

export interface Session {
  id: string;
  authenticator_assurance_level?: string;
  identity: { id: string; traits: { email?: string; username?: string; name?: string } };
  tokenized?: string;
}

/** Kratos's error answers ({ error: { id, message, reason } }), or a flow with messages. */
export class KratosError extends Error {
  constructor(
    readonly status: number,
    readonly id: string | undefined,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const text = await response.text();
  const body = (text ? JSON.parse(text) : undefined) as T;
  return { status: response.status, body };
}

function errorOf(status: number, body: unknown): KratosError {
  const error = (body as { error?: { id?: string; message?: string; reason?: string } } | undefined)?.error;
  const flowMessages = messages(body as Flow | undefined);
  const message = flowMessages[0]?.text ?? error?.reason ?? error?.message ?? `Kratos answered ${status}`;
  return new KratosError(status, error?.id, message, body);
}

/** All messages of a flow, general ones first, then those of the fields. */
export function messages(flow: Flow | undefined): UiText[] {
  if (!flow?.ui) {
    return [];
  }
  return [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((n) => n.messages ?? [])];
}

export function csrfToken(flow: Flow): string {
  const node = flow.ui.nodes.find((n) => n.attributes.name === 'csrf_token');
  return String(node?.attributes.value ?? '');
}

/** Starts a browser flow, e.g. login with {@code aal: 'aal2'} for the second factor. */
export async function createFlow(kind: FlowKind, params: Record<string, string> = {}): Promise<Flow> {
  const query = new URLSearchParams(params).toString();
  const { status, body } = await request<Flow>(`/self-service/${kind}/browser${query ? `?${query}` : ''}`);
  if (status !== 200) {
    throw errorOf(status, body);
  }
  return body;
}

export async function getFlow(kind: FlowKind, id: string): Promise<Flow> {
  const { status, body } = await request<Flow>(`/self-service/${kind}/flows?id=${encodeURIComponent(id)}`);
  if (status !== 200) {
    throw errorOf(status, body);
  }
  return body;
}

export type SubmitResult =
  /** Done; for login the new session. */
  | { kind: 'done'; body: unknown }
  /** Kratos wants the browser elsewhere, e.g. from recovery to the settings flow. */
  | { kind: 'redirect'; to: string }
  /** Invalid input: the flow again, with messages. */
  | { kind: 'invalid'; flow: Flow };

export async function submitFlow(kind: FlowKind, flow: Flow, values: Record<string, unknown>): Promise<SubmitResult> {
  const { status, body } = await request<Record<string, unknown>>(`/self-service/${kind}?flow=${encodeURIComponent(flow.id)}`, {
    method: 'POST',
    body: JSON.stringify({ ...values, csrf_token: csrfToken(flow) }),
  });
  if (status === 200) {
    const next = continueWith(body);
    return next ? { kind: 'redirect', to: next } : { kind: 'done', body };
  }
  if (status === 422 && typeof body?.['redirect_browser_to'] === 'string') {
    return { kind: 'redirect', to: body['redirect_browser_to'] };
  }
  if (status === 400 && body && 'ui' in body) {
    return { kind: 'invalid', flow: body as unknown as Flow };
  }
  throw errorOf(status, body);
}

/** Newer Kratos versions answer with continue_with instead of a redirect, e.g. to the settings flow. */
function continueWith(body: Record<string, unknown> | undefined): string | undefined {
  const items = Array.isArray(body?.['continue_with']) ? (body['continue_with'] as Array<Record<string, unknown>>) : [];
  const settings = items.find((i) => i['action'] === 'show_settings_ui');
  const flow = settings?.['flow'] as { url?: string; id?: string } | undefined;
  return flow?.url ?? (flow?.id ? `/account?flow=${flow.id}` : undefined);
}

/**
 * The current session with a short-lived JWT for the backend (tokenizer template "smarthome").
 * Null when signed out; throws {@link KratosError} with id "session_aal2_required" when the second factor is missing.
 */
export async function whoami(): Promise<Session | null> {
  const { status, body } = await request<Session>('/sessions/whoami?tokenize_as=smarthome');
  if (status === 200) {
    return body;
  }
  if (status === 401) {
    return null;
  }
  throw errorOf(status, body);
}

export async function logout(): Promise<void> {
  const { status, body } = await request<{ logout_token: string }>('/self-service/logout/browser');
  if (status === 401) {
    return;
  }
  if (status !== 200) {
    throw errorOf(status, body);
  }
  await request(`/self-service/logout?token=${encodeURIComponent(body.logout_token)}`);
}

export async function getError(id: string): Promise<{ message: string; reason?: string }> {
  const { body } = await request<{ error?: { message?: string; reason?: string } }>(`/self-service/errors?id=${encodeURIComponent(id)}`);
  return { message: body?.error?.message ?? 'Unbekannter Fehler', ...(body?.error?.reason ? { reason: body.error.reason } : {}) };
}

/** Turns Kratos's redirect targets (its ui_url, i.e. pages of this interface) into a path of this interface. */
export function localPath(url: string): string {
  const parsed = new URL(url, window.location.origin);
  return parsed.pathname + parsed.search;
}

/** Seconds since epoch until which the JWT is valid. */
export function jwtExpiry(jwt: string): number {
  const payload = jwt.split('.')[1] ?? '';
  const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
  return json.exp ?? 0;
}
