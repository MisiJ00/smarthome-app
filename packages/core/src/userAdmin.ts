// Users, roles, rights and the audit log (admin): the same for the web interface and the phone app. The hooks need the
// app's own API client, so they come from a factory; the pure helpers (labels, formatting) are exported as is.
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { unwrap, type ApiClient, type components } from '@smarthome/api-client';

import { actionLabel } from './capabilities';

type S = components['schemas'];
export type User = S['UserResponse'];
export type UserDetail = S['UserDetailResponse'];
export type CreatedUser = S['CreatedUserResponse'];
export type SetupCode = S['SetupCode'];
export type Role = S['RoleResponse'];
export type Grant = S['GrantResponse'];
export type CreateGrant = S['CreateGrantRequest'];
export type EffectivePermissions = S['EffectivePermissions'];
export type TrustedDevice = S['TrustedDeviceResponse'];
export type AuditEntry = S['AuditResponse'];
export type AuditFilter = {
  userId?: number;
  deviceId?: number;
  result?: NonNullable<AuditEntry['result']>;
  via?: NonNullable<AuditEntry['via']>;
  from?: string;
  to?: string;
  page: number;
  size: number;
};

export const userAdminKeys = {
  users: ['admin', 'users'] as const,
  user: (id: number) => ['admin', 'users', id] as const,
  effective: (id: number) => ['admin', 'users', id, 'effective'] as const,
  trusted: (id: number) => ['admin', 'users', id, 'trusted'] as const,
  roles: ['admin', 'roles'] as const,
  grants: (subjectType: string, subjectId: number) => ['admin', 'grants', subjectType, subjectId] as const,
  audit: (filter: AuditFilter) => ['admin', 'audit', filter] as const,
};

const keys = userAdminKeys;

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  bewohner: 'Bewohner',
  gast: 'Gast',
  ki: 'KI',
};

export function roleLabel(role: string | undefined): string {
  return ROLE_LABELS[role ?? ''] ?? role ?? '';
}

/** A time for people (German date and time), a dash when there is none. */
export function formatTime(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' }) : '–';
}

export const AUDIT_RESULTS: Record<NonNullable<AuditEntry['result']>, string> = {
  sent: 'ausgeführt',
  denied: 'kein Recht',
  locked: 'gesperrt',
  pending: 'wartet auf Freigabe',
  approved: 'freigegeben',
  rejected: 'abgelehnt',
  expired: 'abgelaufen',
  registered: 'registriert',
  revoked: 'gesperrt (Handy)',
  started: 'gestartet',
  stopped: 'beendet',
};

export const AUDIT_VIA: Record<NonNullable<AuditEntry['via']>, string> = { web: 'Web', app: 'App', widget: 'Widget', ki: 'KI', system: 'System' };

/** What an audit entry did, in a short German line. */
export function auditDescription(entry: AuditEntry): string {
  const params = entry.params ?? {};
  if (entry.action === 'permit_join') {
    return `Anlernmodus${params['seconds'] ? ` (${String(params['seconds'])} s)` : ''}`;
  }
  if (entry.action === 'trusted_device') {
    return `${params['kind'] === 'webauthn' ? 'Browser' : 'Handy'} ${String(params['name'] ?? '')}`;
  }
  const values = Object.entries(params)
    .filter(([key]) => !['requestedBy', 'approvedWith'].includes(key))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
  const extra = params['approvedWith'] ? ` · per ${String(params['approvedWith'])}` : '';
  return `${actionLabel(entry.action ?? '')}${values ? ` (${values})` : ''}${extra}`;
}

/** How an audit result should look: green for done, red for refused, amber for waiting. */
export function auditTone(result: AuditEntry['result']): 'ok' | 'warn' | 'error' | undefined {
  switch (result) {
    case 'sent':
    case 'approved':
      return 'ok';
    case 'denied':
    case 'locked':
    case 'rejected':
      return 'error';
    case 'pending':
    case 'expired':
      return 'warn';
    default:
      return undefined;
  }
}

/** The hooks for users, roles, grants and the audit log. `useApi` is the client of the calling app. */
export function createUserAdminHooks(options: { useApi: () => ApiClient }) {
  const { useApi } = options;

  /** A mutation that reloads the given queries afterwards (also when it failed, the server state may have changed). */
  function useAdminMutation<A, R>(fn: (args: A) => Promise<R>, invalidate: QueryKey[]) {
    const queries = useQueryClient();
    return useMutation({
      mutationFn: fn,
      onSettled: () => Promise.all(invalidate.map((key) => queries.invalidateQueries({ queryKey: key }))),
    });
  }

  return {
    useUsers() {
      const api = useApi();
      return useQuery({ queryKey: keys.users, queryFn: async (): Promise<User[]> => unwrap(await api.GET('/api/users')) });
    },

    useUser(id: number) {
      const api = useApi();
      return useQuery({
        queryKey: keys.user(id),
        queryFn: async (): Promise<UserDetail> => unwrap(await api.GET('/api/users/{id}', { params: { path: { id } } })),
      });
    },

    useEffectivePermissions(id: number) {
      const api = useApi();
      return useQuery({
        queryKey: keys.effective(id),
        queryFn: async (): Promise<EffectivePermissions> =>
          unwrap(await api.GET('/api/users/{id}/effective-permissions', { params: { path: { id } } })),
      });
    },

    useTrustedDevices(userId: number) {
      const api = useApi();
      return useQuery({
        queryKey: keys.trusted(userId),
        queryFn: async (): Promise<TrustedDevice[]> =>
          unwrap(await api.GET('/api/users/{userId}/trusted-devices', { params: { path: { userId } } })),
      });
    },

    useRevokeTrustedDevice(userId: number) {
      const api = useApi();
      return useAdminMutation(
        async (id: number) => unwrap(await api.DELETE('/api/users/{userId}/trusted-devices/{id}', { params: { path: { userId, id } } })),
        [keys.trusted(userId)],
      );
    },

    useCreateUser() {
      const api = useApi();
      return useAdminMutation(
        async (body: S['CreateUserRequest']): Promise<CreatedUser> => unwrap(await api.POST('/api/users', { body })),
        [keys.users],
      );
    },

    useNewSetupCode() {
      const api = useApi();
      return useMutation({
        mutationFn: async (id: number): Promise<SetupCode> => unwrap(await api.POST('/api/users/{id}/setup-code', { params: { path: { id } } })),
      });
    },

    useUpdateUser() {
      const api = useApi();
      return useAdminMutation(
        async ({ id, body }: { id: number; body: S['UpdateUserRequest'] }) =>
          unwrap(await api.PATCH('/api/users/{id}', { params: { path: { id } }, body })),
        [keys.users, ['admin', 'users']],
      );
    },

    useSetRoles() {
      const api = useApi();
      return useAdminMutation(
        async ({ id, roles }: { id: number; roles: string[] }) =>
          unwrap(await api.PUT('/api/users/{id}/roles', { params: { path: { id } }, body: { roles } })),
        [['admin', 'users'], ['admin', 'roles']],
      );
    },

    useDeleteUser() {
      const api = useApi();
      return useAdminMutation(async (id: number) => unwrap(await api.DELETE('/api/users/{id}', { params: { path: { id } } })), [keys.users]);
    },

    useRoles() {
      const api = useApi();
      return useQuery({ queryKey: keys.roles, queryFn: async (): Promise<Role[]> => unwrap(await api.GET('/api/roles')) });
    },

    useCreateRole() {
      const api = useApi();
      return useAdminMutation(async (name: string) => unwrap(await api.POST('/api/roles', { body: { name } })), [keys.roles]);
    },

    useDeleteRole() {
      const api = useApi();
      return useAdminMutation(async (id: number) => unwrap(await api.DELETE('/api/roles/{id}', { params: { path: { id } } })), [keys.roles]);
    },

    useGrants(subjectType: 'role' | 'user', subjectId: number | undefined) {
      const api = useApi();
      return useQuery({
        queryKey: keys.grants(subjectType, subjectId ?? 0),
        enabled: subjectId !== undefined,
        queryFn: async (): Promise<Grant[]> => unwrap(await api.GET('/api/grants', { params: { query: { subjectType, subjectId } } })),
      });
    },

    useCreateGrant() {
      const api = useApi();
      return useAdminMutation(async (body: CreateGrant) => unwrap(await api.POST('/api/grants', { body })), [['admin', 'grants'], ['admin', 'users']]);
    },

    useUpdateGrant() {
      const api = useApi();
      return useAdminMutation(
        async ({ id, requiresConfirmation }: { id: number; requiresConfirmation: boolean }) =>
          unwrap(await api.PATCH('/api/grants/{id}', { params: { path: { id } }, body: { requiresConfirmation } })),
        [['admin', 'grants'], ['admin', 'users']],
      );
    },

    useDeleteGrant() {
      const api = useApi();
      return useAdminMutation(
        async (id: number) => unwrap(await api.DELETE('/api/grants/{id}', { params: { path: { id } } })),
        [['admin', 'grants'], ['admin', 'users']],
      );
    },

    useAudit(filter: AuditFilter) {
      const api = useApi();
      return useQuery({
        queryKey: keys.audit(filter),
        queryFn: async () => unwrap(await api.GET('/api/audit', { params: { query: filter } })),
        placeholderData: (previous) => previous,
      });
    },
  };
}
