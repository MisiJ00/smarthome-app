import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { CloseCodes, unwrap, type Confirmation, type Device, type LiveEvent, type Room } from '@smarthome/api-client';
import { applyToDevices, applyToPendingConfirmations, applyToRooms, pairingKeys, widgetDeviceIds, type ServerWidget } from '@smarthome/core';

import { keys, useApi } from './api';
import { useServer } from './auth';
import { webSocketUrl } from './server';
import { widgetKeys } from './widgets';

export type LiveStatus = 'connecting' | 'live' | 'offline';

/**
 * Keeps devices, rooms and confirmations up to date over /api/events, like the web interface. Reconnects with a
 * growing delay, and right away when the app comes back to the foreground; after every connect the state is loaded
 * again, because events only carry changes.
 */
export function useLiveEvents(onEvent?: (event: LiveEvent) => void): LiveStatus {
  const api = useApi();
  const server = useServer();
  const queries = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    let widgetRefresh: ReturnType<typeof setTimeout> | undefined;

    const apply = (event: LiveEvent) => {
      queries.setQueryData<Device[]>(keys.devices, (old) => (old ? applyToDevices(old, event) : old));
      queries.setQueryData<Room[]>(keys.rooms, (old) => (old ? applyToRooms(old, event) : old));
      queries.setQueryData<Confirmation[]>(keys.pendingConfirmations, (old) => (old ? applyToPendingConfirmations(old, event) : old));
      if (event.type === 'permissions.changed') {
        void queries.invalidateQueries();
      }
      // The widgets changed on another device (or an admin changed what the person may see): load them again
      if (event.type === 'widgets.changed') {
        void queries.invalidateQueries({ queryKey: ['widgets'] });
      }
      // The state of a device on the widget changed: its tile is drawn from the server's data, so ask again (not for every
      // reading, a second after the last one)
      if (event.type === 'device.state') {
        const onWidget = widgetDeviceIds(queries.getQueryData<ServerWidget[]>(widgetKeys.list));
        if (onWidget.has(String(event.data.deviceId))) {
          clearTimeout(widgetRefresh);
          widgetRefresh = setTimeout(() => void queries.invalidateQueries({ queryKey: widgetKeys.data }), 1000);
        }
      }
      // pairing and newly found devices (only admins have them loaded; for others this is a no-op)
      if (event.type === 'pairing.started' || event.type === 'pairing.stopped') {
        void queries.invalidateQueries({ queryKey: pairingKeys.pairing });
      }
      if (event.type === 'device.discovered' || event.type === 'device.added' || event.type === 'device.removed') {
        void queries.invalidateQueries({ queryKey: pairingKeys.discovered });
      }
      handler.current?.(event);
    };

    const schedule = (immediately: boolean) => {
      if (stopped) {
        return;
      }
      setStatus('offline');
      clearTimeout(retry);
      retry = setTimeout(() => void connect(), immediately ? 0 : Math.min(30_000, 1000 * 2 ** attempt));
      attempt += 1;
    };

    const connect = async () => {
      if (stopped || socket) {
        return;
      }
      setStatus('connecting');
      let ticket: string;
      try {
        ticket = unwrap(await api.POST('/api/events/ticket')).ticket ?? '';
      } catch {
        schedule(false);
        return;
      }
      socket = new WebSocket(webSocketUrl(server, `/api/events?ticket=${encodeURIComponent(ticket)}`));
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
        schedule(close.code === CloseCodes.Reconnect);
      };
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !socket) {
        attempt = 0;
        schedule(true);
      }
    });

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      subscription.remove();
      socket?.close();
    };
  }, [api, server, queries]);

  return status;
}
