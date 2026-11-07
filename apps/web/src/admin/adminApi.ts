import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { unwrap, type components } from '@smarthome/api-client';
import { createDeviceAdminHooks, pairingKeys, type Discovered, type Pairing } from '@smarthome/core';

import { keys, useApi } from '../api';

type S = components['schemas'];
export type User = S['UserResponse'];
export type UserDetail = S['UserDetailResponse'];
export type CreatedUser = S['CreatedUserResponse'];
export type SetupCode = S['SetupCode'];
export type Role = S['RoleResponse'];
export type Grant = S['GrantResponse'];
export type CreateGrant = S['CreateGrantRequest'];
export type { Discovered, Pairing };
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

export const adminKeys = {
  ...pairingKeys,
  users: ['admin', 'users'] as const,
  user: (id: number) => ['admin', 'users', id] as const,
  effective: (id: number) => ['admin', 'users', id, 'effective'] as const,
  trusted: (id: number) => ['admin', 'users', id, 'trusted'] as const,
  roles: ['admin', 'roles'] as const,
  grants: (subjectType: string, subjectId: number) => ['admin', 'grants', subjectType, subjectId] as const,
  audit: (filter: AuditFilter) => ['admin', 'audit', filter] as const,
};

/** A mutation that reloads the given queries afterwards (also when it failed, the server state may have changed). */
function useAdminMutation<A, R>(fn: (args: A) => Promise<R>, invalidate: QueryKey[]) {
  const queries = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(invalidate.map((key) => queries.invalidateQueries({ queryKey: key }))),
  });
}

// Pairing and devices

// Pairing, devices and rooms are shared with the phone app (packages/core/src/admin.ts)
export const {
  usePairing,
  useStartPairing,
  useStopPairing,
  useDiscovered,
  useAddDevice,
  useUpdateDevice,
  useRemoveDevice,
  useCreateRoom,
  useUpdateRoom,
  useReorderRooms,
  useDeleteRoom,
} = createDeviceAdminHooks({ useApi, keys });

// Users and roles

export function useUsers() {
  const api = useApi();
  return useQuery({ queryKey: adminKeys.users, queryFn: async (): Promise<User[]> => unwrap(await api.GET('/api/users')) });
}

export function useUser(id: number) {
  const api = useApi();
  return useQuery({ queryKey: adminKeys.user(id), queryFn: async (): Promise<UserDetail> => unwrap(await api.GET('/api/users/{id}', { params: { path: { id } } })) });
}

export function useEffectivePermissions(id: number) {
  const api = useApi();
  return useQuery({
    queryKey: adminKeys.effective(id),
    queryFn: async (): Promise<EffectivePermissions> => unwrap(await api.GET('/api/users/{id}/effective-permissions', { params: { path: { id } } })),
  });
}

export function useTrustedDevices(userId: number) {
  const api = useApi();
  return useQuery({
    queryKey: adminKeys.trusted(userId),
    queryFn: async (): Promise<TrustedDevice[]> => unwrap(await api.GET('/api/users/{userId}/trusted-devices', { params: { path: { userId } } })),
  });
}

export function useRevokeTrustedDevice(userId: number) {
  const api = useApi();
  return useAdminMutation(
    async (id: number) => unwrap(await api.DELETE('/api/users/{userId}/trusted-devices/{id}', { params: { path: { userId, id } } })),
    [adminKeys.trusted(userId)],
  );
}

export function useCreateUser() {
  const api = useApi();
  return useAdminMutation(async (body: S['CreateUserRequest']): Promise<CreatedUser> => unwrap(await api.POST('/api/users', { body })), [adminKeys.users]);
}

export function useNewSetupCode() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: number): Promise<SetupCode> => unwrap(await api.POST('/api/users/{id}/setup-code', { params: { path: { id } } })),
  });
}

export function useUpdateUser() {
  const api = useApi();
  return useAdminMutation(
    async ({ id, body }: { id: number; body: S['UpdateUserRequest'] }) =>
      unwrap(await api.PATCH('/api/users/{id}', { params: { path: { id } }, body })),
    [adminKeys.users, ['admin', 'users']],
  );
}

export function useSetRoles() {
  const api = useApi();
  return useAdminMutation(
    async ({ id, roles }: { id: number; roles: string[] }) =>
      unwrap(await api.PUT('/api/users/{id}/roles', { params: { path: { id } }, body: { roles } })),
    [['admin', 'users'], ['admin', 'roles']],
  );
}

export function useDeleteUser() {
  const api = useApi();
  return useAdminMutation(async (id: number) => unwrap(await api.DELETE('/api/users/{id}', { params: { path: { id } } })), [adminKeys.users]);
}

export function useRoles() {
  const api = useApi();
  return useQuery({ queryKey: adminKeys.roles, queryFn: async (): Promise<Role[]> => unwrap(await api.GET('/api/roles')) });
}

export function useCreateRole() {
  const api = useApi();
  return useAdminMutation(async (name: string) => unwrap(await api.POST('/api/roles', { body: { name } })), [adminKeys.roles]);
}

export function useDeleteRole() {
  const api = useApi();
  return useAdminMutation(async (id: number) => unwrap(await api.DELETE('/api/roles/{id}', { params: { path: { id } } })), [adminKeys.roles]);
}

// Grants

export function useGrants(subjectType: 'role' | 'user', subjectId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: adminKeys.grants(subjectType, subjectId ?? 0),
    enabled: subjectId !== undefined,
    queryFn: async (): Promise<Grant[]> => unwrap(await api.GET('/api/grants', { params: { query: { subjectType, subjectId } } })),
  });
}

export function useCreateGrant() {
  const api = useApi();
  return useAdminMutation(async (body: CreateGrant) => unwrap(await api.POST('/api/grants', { body })), [['admin', 'grants'], ['admin', 'users']]);
}

export function useUpdateGrant() {
  const api = useApi();
  return useAdminMutation(
    async ({ id, requiresConfirmation }: { id: number; requiresConfirmation: boolean }) =>
      unwrap(await api.PATCH('/api/grants/{id}', { params: { path: { id } }, body: { requiresConfirmation } })),
    [['admin', 'grants'], ['admin', 'users']],
  );
}

export function useDeleteGrant() {
  const api = useApi();
  return useAdminMutation(async (id: number) => unwrap(await api.DELETE('/api/grants/{id}', { params: { path: { id } } })), [['admin', 'grants'], ['admin', 'users']]);
}

// Audit log

export function useAudit(filter: AuditFilter) {
  const api = useApi();
  return useQuery({
    queryKey: adminKeys.audit(filter),
    queryFn: async () => unwrap(await api.GET('/api/audit', { params: { query: filter } })),
    placeholderData: (previous) => previous,
  });
}
