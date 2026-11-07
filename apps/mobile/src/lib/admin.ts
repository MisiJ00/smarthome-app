// Setting up rooms and devices from the phone: the same hooks as the web's admin pages (packages/core/src/admin.ts),
// bound to the app's API client.
import { createDeviceAdminHooks } from '@smarthome/core';

import { keys, useApi, useMe } from './api';

export { errorText, lockableActions, PAIRING_SECONDS, secondsUntil, type Discovered, type Pairing } from '@smarthome/core';

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

/** Whether the signed-in user is an admin (the admin screens are only offered to them; the backend checks anyway). */
export function useIsAdmin(): boolean {
  return useMe().data?.roles?.includes('admin') ?? false;
}
