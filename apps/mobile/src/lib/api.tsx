import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createApiClient, unwrap, type ApiClient, type CommandResponse, type Confirmation, type Device, type Room } from '@smarthome/api-client';

import { useAuth, useServer } from './auth';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const server = useServer();
  const client = useMemo(() => createApiClient({ baseUrl: server, client: 'app', getToken }), [server, getToken]);
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
  phones: ['phones'] as const,
  notifications: ['notifications'] as const,
};

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: keys.me, queryFn: async () => unwrap(await api.GET('/api/me')) });
}

/** Where this user subscribes for push messages in the ntfy app (approval requests). */
export function useNotifications() {
  const api = useApi();
  return useQuery({ queryKey: keys.notifications, queryFn: async () => unwrap(await api.GET('/api/me/notifications')) });
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
