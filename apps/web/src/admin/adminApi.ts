import {
  createDeviceAdminHooks,
  createUserAdminHooks,
  pairingKeys,
  userAdminKeys,
  type AuditEntry,
  type AuditFilter,
  type CreateGrant,
  type CreatedUser,
  type Discovered,
  type EffectivePermissions,
  type Grant,
  type Pairing,
  type Role,
  type SetupCode,
  type TrustedDevice,
  type User,
  type UserDetail,
} from '@smarthome/core';

import { keys, useApi } from '../api';

export type { AuditEntry, AuditFilter, CreateGrant, CreatedUser, Discovered, EffectivePermissions, Grant, Pairing, Role, SetupCode, TrustedDevice, User, UserDetail };

export const adminKeys = { ...pairingKeys, ...userAdminKeys };

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

// Users, roles, rights and the audit log are shared with the phone app (packages/core/src/userAdmin.ts)
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
