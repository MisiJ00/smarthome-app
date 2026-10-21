import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { CloseCodes, unwrap, type Confirmation, type Device, type LiveEvent, type Room } from '@smarthome/api-client';
import { applyToDevices, applyToPendingConfirmations, applyToRooms } from '@smarthome/core';

import { keys, useApi } from '../api';

export type LiveStatus = 'connecting' | 'live' | 'offline';

/**
 * Keeps devices, rooms and confirmations up to date over /api/events. After every (re)connect the state is loaded
 * again via REST, because events only carry changes. Reconnects with a growing delay (1 s up to 30 s).
 */
export function useLiveEvents(onEvent?: (event: LiveEvent) => void): LiveStatus {
  const api = useApi();
  const queries = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const apply = (event: LiveEvent) => {
      queries.setQueryData<Device[]>(keys.devices, (old) => (old ? applyToDevices(old, event) : old));
      queries.setQueryData<Room[]>(keys.rooms, (old) => (old ? applyToRooms(old, event) : old));
      queries.setQueryData<Confirmation[]>(keys.pendingConfirmations, (old) =>
        old ? applyToPendingConfirmations(old, event) : old,
      );
      if (event.type === 'permissions.changed') {
        void queries.invalidateQueries();
      }
      onEvent?.(event);
    };

    const scheduleReconnect = (immediately: boolean) => {
      if (stopped) {
        return;
      }
      setStatus('offline');
      const delay = immediately ? 0 : Math.min(30_000, 1000 * 2 ** attempt);
      attempt += 1;
      retry = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      setStatus('connecting');
      let ticket: string;
      try {
        ticket = unwrap(await api.POST('/api/events/ticket')).ticket ?? '';
      } catch {
        scheduleReconnect(false);
        return;
      }
      if (stopped) {
        return;
      }
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://${window.location.host}/api/events?ticket=${encodeURIComponent(ticket)}`);
      socket.onmessage = (message) => {
        const event = JSON.parse(String(message.data)) as LiveEvent;
        if (event.type === 'hello') {
          attempt = 0;
          setStatus('live');
          void queries.invalidateQueries();
        }
        apply(event);
      };
      socket.onclose = (close) => {
        socket = undefined;
        // 4000: connection too old, fetch a new ticket right away
        scheduleReconnect(close.code === CloseCodes.Reconnect);
      };
    };

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [api, queries, onEvent]);

  return status;
}
