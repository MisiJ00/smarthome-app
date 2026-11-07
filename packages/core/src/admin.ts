// Setting up rooms and devices (pairing, adopting, editing, removing), the same for the web interface and the phone app.
// The hooks need the app's own API client and query keys, so they come from a factory; the pure helpers are exported as is.
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { ApiError, unwrap, type ApiClient, type components, type Device } from '@smarthome/api-client';

import { features } from './capabilities';

type S = components['schemas'];
export type Discovered = S['DiscoveredDevice'];
export type Pairing = S['PairingResponse'];

/** How long pairing is opened for, in seconds (the most Zigbee2MQTT allows). */
export const PAIRING_SECONDS = 254;

/** Query keys of pairing and the newly found devices. */
export const pairingKeys = {
  pairing: ['admin', 'pairing'] as const,
  discovered: ['admin', 'discovered'] as const,
};

/** The backend's problem detail (German, comes with the response), or a general message. */
export function errorText(error: unknown, fallback = 'Das hat nicht geklappt'): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Seconds from `now` (ms) until the ISO time `until`; 0 when it has passed or there is none. */
export function secondsUntil(until: string | undefined, now: number): number {
  return until ? Math.max(0, Math.round((new Date(until).getTime() - now) / 1000)) : 0;
}

/**
 * Actions that can be locked for a device, as the backend names them (CommandGuard): switching, locking and
 * setting each value. Already locked ones are always offered so they can be unlocked again.
 */
export function lockableActions(device: Device): string[] {
  const result = new Set<string>();
  for (const feature of features(device.capabilities)) {
    if (!feature.settable) {
      continue;
    }
    if (feature.property === 'state' && feature.kind === 'binary') {
      if (device.type === 'lock') {
        result.add('lock').add('unlock');
      } else {
        result.add('switch_on').add('switch_off');
      }
    } else {
      result.add(`set_${feature.property}`);
    }
  }
  (device.lockedActions ?? []).forEach((a) => result.add(a));
  return [...result];
}

/**
 * The hooks for rooms and devices. `useApi` is the client of the calling app, `keys` its queries for rooms and devices
 * (reloaded after every change).
 */
export function createDeviceAdminHooks(options: {
  useApi: () => ApiClient;
  keys: { rooms: QueryKey; devices: QueryKey };
}) {
  const { useApi, keys } = options;

  /** A mutation that reloads the given queries afterwards (also when it failed, the server state may have changed). */
  function useAdminMutation<A, R>(fn: (args: A) => Promise<R>, invalidate: QueryKey[]) {
    const queries = useQueryClient();
    return useMutation({
      mutationFn: fn,
      onSettled: () => Promise.all(invalidate.map((key) => queries.invalidateQueries({ queryKey: key }))),
    });
  }

  return {
    usePairing() {
      const api = useApi();
      return useQuery({
        queryKey: pairingKeys.pairing,
        queryFn: async (): Promise<Pairing> => unwrap(await api.GET('/api/adapters/z2m/permit-join')),
      });
    },

    useStartPairing() {
      const api = useApi();
      return useAdminMutation(
        async (seconds: number) => unwrap(await api.POST('/api/adapters/z2m/permit-join', { body: { seconds } })),
        [pairingKeys.pairing],
      );
    },

    useStopPairing() {
      const api = useApi();
      return useAdminMutation(async () => unwrap(await api.DELETE('/api/adapters/z2m/permit-join')), [pairingKeys.pairing]);
    },

    useDiscovered() {
      const api = useApi();
      return useQuery({
        queryKey: pairingKeys.discovered,
        queryFn: async (): Promise<Discovered[]> => unwrap(await api.GET('/api/devices/discovered')),
      });
    },

    useAddDevice() {
      const api = useApi();
      return useAdminMutation(
        async (body: S['AddDeviceRequest']) => unwrap(await api.POST('/api/devices', { body })),
        [pairingKeys.discovered, keys.devices, keys.rooms],
      );
    },

    useUpdateDevice() {
      const api = useApi();
      return useAdminMutation(
        async ({ id, body }: { id: number; body: S['UpdateDeviceRequest'] }) =>
          unwrap(await api.PATCH('/api/devices/{id}', { params: { path: { id } }, body })),
        [keys.devices, keys.rooms],
      );
    },

    useRemoveDevice() {
      const api = useApi();
      return useAdminMutation(
        async (id: number) => unwrap(await api.DELETE('/api/devices/{id}', { params: { path: { id } } })),
        [keys.devices, keys.rooms, pairingKeys.discovered],
      );
    },

    useCreateRoom() {
      const api = useApi();
      return useAdminMutation(async (body: S['CreateRoomRequest']) => unwrap(await api.POST('/api/rooms', { body })), [keys.rooms]);
    },

    useUpdateRoom() {
      const api = useApi();
      return useAdminMutation(
        async ({ id, body }: { id: number; body: S['UpdateRoomRequest'] }) =>
          unwrap(await api.PATCH('/api/rooms/{id}', { params: { path: { id } }, body })),
        [keys.rooms],
      );
    },

    useReorderRooms() {
      const api = useApi();
      return useAdminMutation(async (roomIds: number[]) => unwrap(await api.PUT('/api/rooms/order', { body: { roomIds } })), [keys.rooms]);
    },

    useDeleteRoom() {
      const api = useApi();
      return useAdminMutation(async (id: number) => unwrap(await api.DELETE('/api/rooms/{id}', { params: { path: { id } } })), [keys.rooms]);
    },
  };
}
