import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createApiClient, unwrap, type ApiClient, type CommandResponse, type components, type Confirmation, type Device, type Room } from '@smarthome/api-client';

import { createApprovalCredential, signApproval } from './auth/approvalPasskey';
import { useAuth } from './auth/AuthProvider';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken, refresh } = useAuth();
  const client = useMemo(
    () => createApiClient({ client: 'web', getToken, onUnauthorized: () => void refresh() }),
    [getToken, refresh],
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApi outside of ApiProvider');
  }
  return client;
}

export const keys = {
  me: ['me'] as const,
  rooms: ['rooms'] as const,
  devices: ['devices'] as const,
  pendingConfirmations: ['confirmations', 'pending'] as const,
  myTrustedDevices: ['me', 'trusted-devices'] as const,
};

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: keys.me, queryFn: async () => unwrap(await api.GET('/api/me')) });
}

export function useRooms() {
  const api = useApi();
  return useQuery({ queryKey: keys.rooms, queryFn: async (): Promise<Room[]> => unwrap(await api.GET('/api/rooms')) });
}

export function useDevices() {
  const api = useApi();
  return useQuery({ queryKey: keys.devices, queryFn: async (): Promise<Device[]> => unwrap(await api.GET('/api/devices', {})) });
}

export function usePendingConfirmations() {
  const api = useApi();
  return useQuery({
    queryKey: keys.pendingConfirmations,
    queryFn: async (): Promise<Confirmation[]> => unwrap(await api.GET('/api/confirmations', { params: { query: { status: 'pending' } } })),
  });
}

/** Sends a command; the new state arrives as live event. */
export function useCommand() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceId, command }: { deviceId: number; command: Record<string, unknown> }): Promise<CommandResponse> =>
      unwrap(await api.POST('/api/devices/{id}/commands', { params: { path: { id: deviceId } }, body: command })),
    onSuccess: (result) => {
      if (result.status === 'confirmation_required') {
        void queries.invalidateQueries({ queryKey: keys.pendingConfirmations });
      }
    },
  });
}

export type TrustedDevice = components['schemas']['TrustedDeviceResponse'];

/** The caller's own phones and browser passkeys that may sign approvals. */
export function useMyTrustedDevices() {
  const api = useApi();
  return useQuery({
    queryKey: keys.myTrustedDevices,
    queryFn: async (): Promise<TrustedDevice[]> => unwrap(await api.GET('/api/me/trusted-devices')),
  });
}

export function useRevokeMyTrustedDevice() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => unwrap(await api.DELETE('/api/me/trusted-devices/{id}', { params: { path: { id } } })),
    onSettled: () => queries.invalidateQueries({ queryKey: keys.myTrustedDevices }),
  });
}

/** Registers a browser passkey as trusted device: challenge, the browser creates the credential, the backend checks it. */
export function useRegisterBrowserPasskey() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const options = unwrap(await api.POST('/api/me/trusted-devices/webauthn/challenge'));
      const created = await createApprovalCredential(options);
      return unwrap(await api.POST('/api/me/trusted-devices/webauthn', { body: { name, ...created } }));
    },
    onSettled: () => queries.invalidateQueries({ queryKey: keys.myTrustedDevices }),
  });
}

/** Approves one's own request with a browser passkey: challenge, one gesture, signed approval. */
export function useApproveWithPasskey() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, device }: { id: number; device: TrustedDevice }) => {
      if (device.id === undefined || !device.credentialId) {
        throw new Error('Dieser Passkey ist unvollständig.');
      }
      const challenge = unwrap(await api.POST('/api/confirmations/{id}/challenge', { params: { path: { id } } }));
      const signed = await signApproval(challenge.payload ?? '', device.credentialId);
      return unwrap(
        await api.POST('/api/confirmations/{id}/approve', {
          params: { path: { id } },
          body: { trustedDeviceId: device.id, nonce: challenge.nonce, ...signed },
        }),
      );
    },
    onSettled: () => queries.invalidateQueries({ queryKey: keys.pendingConfirmations }),
  });
}

export function useDecide() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: number; approve: boolean }) =>
      approve
        ? unwrap(await api.POST('/api/confirmations/{id}/approve', { params: { path: { id } } }))
        : unwrap(await api.POST('/api/confirmations/{id}/reject', { params: { path: { id } } })),
    onSettled: () => queries.invalidateQueries({ queryKey: keys.pendingConfirmations }),
  });
}
