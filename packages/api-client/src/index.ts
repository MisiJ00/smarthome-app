import createClient, { type Middleware } from 'openapi-fetch';

import type { components, paths } from './schema';

export type { components, paths } from './schema';

type Schemas = components['schemas'];

export type Device = Schemas['DeviceResponse'];
export type DevicePermission = Schemas['DevicePermission'];
export type Action = NonNullable<DevicePermission['action']>;
export type Room = Schemas['RoomResponse'];
export type Confirmation = Schemas['ConfirmationResponse'];
export type CommandResponse = Schemas['CommandResponse'];
export type Me = Schemas['CurrentUser'];

/** Which client is calling; the backend writes it into the audit log. */
export type ClientKind = 'web' | 'app' | 'widget';

export interface ApiClientOptions {
  /** Base URL of the backend; empty for the same origin (the web interface goes through a proxy). */
  baseUrl?: string;
  client: ClientKind;
  /** The current JWT (or null when signed out). Called for every request. */
  getToken: () => Promise<string | null>;
  /** Called once when the backend answers 401, e.g. to fetch a new JWT; the request is not retried. */
  onUnauthorized?: () => void;
}

export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl: options.baseUrl ?? '' });
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await options.getToken();
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      request.headers.set('X-Smarthome-Client', options.client);
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) {
        options.onUnauthorized?.();
      }
      return response;
    },
  };
  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The backend answers errors as RFC 9457 problem details. */
export interface ProblemDetail {
  status?: number;
  title?: string;
  detail?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetail | undefined,
  ) {
    super(problem?.detail ?? problem?.title ?? `Request failed (${status})`);
  }
}

/** Unwraps an openapi-fetch result: the data, or an {@link ApiError}. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error as ProblemDetail | undefined);
  }
  return result.data as T;
}

export * from './events';
