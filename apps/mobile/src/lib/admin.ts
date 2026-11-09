// Setting up rooms and devices from the phone: the same hooks as the web's admin pages (packages/core/src/admin.ts),
// bound to the app's API client.
import { createDeviceAdminHooks, createUserAdminHooks } from '@smarthome/core';

import { keys, useApi, useMe } from './api';

export {
  AUDIT_ACTIONS,
  AUDIT_RESULTS,
  AUDIT_VIA,
  auditDescription,
  auditTone,
  errorText,
  formatTime,
  lockableActions,
  PAIRING_SECONDS,
  roleLabel,
  secondsUntil,
  type AuditEntry,
  type AuditFilter,
  type CreatedUser,
  type Discovered,
  type Grant,
  type Pairing,
  type SetupCode,
  type User,
} from '@smarthome/core';

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

// Users, roles, rights and the audit log (packages/core/src/userAdmin.ts)
export const {
  useUsers,
  useUser,
  useEffectivePermissions,
  useTrustedDevices,
  useRevokeTrustedDevice,
  useCreateUser,
  useNewSetupCode,
  useUpdateUser,
  useSetRoles,
  useDeleteUser,
  useRoles,
  useCreateRole,
  useDeleteRole,
  useGrants,
  useCreateGrant,
  useUpdateGrant,
  useDeleteGrant,
  useAudit,
} = createUserAdminHooks({ useApi });

/** Whether the signed-in user is an admin (the admin screens are only offered to them; the backend checks anyway). */
export function useIsAdmin(): boolean {
  return useMe().data?.roles?.includes('admin') ?? false;
}
