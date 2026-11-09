import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { unwrap, type Device } from '@smarthome/api-client';
import { widgetConfigFor, widgetKindFor, widgetsStillToTakeOver, type DashboardLayout, type WidgetData } from '@smarthome/core';

import { useApi } from './api';

// The widgets of the signed-in person live on the server (/api/me/widgets). The home screen widget draws from the
// compact data (/api/me/widgets/data); the app selects, orders and removes through the API. Nothing about them is kept
// on the phone except the last drawn tiles (names and states, no secrets; see widget/data.ts) for the offline case.

export const widgetKeys = {
  list: ['widgets', 'list'] as const,
  data: ['widgets', 'data'] as const,
};

const takeoverKey = (userId: number | string) => `smarthome.widgets.takeover.${userId}`;

/** The person's widgets (ids, kinds, targets), in the server's order. */
export function useWidgets() {
  const api = useApi();
  return useQuery({ queryKey: widgetKeys.list, queryFn: async () => unwrap(await api.GET('/api/me/widgets')) });
}

/** The compact data the home screen widget draws: names, state and allowed actions, "available: false" without a right. */
export function useWidgetData() {
  const api = useApi();
  return useQuery({
    queryKey: widgetKeys.data,
    queryFn: async (): Promise<WidgetData[]> => unwrap(await api.GET('/api/me/widgets/data')).widgets ?? [],
  });
}

/** Puts a device on the widget with the kind that fits its type. */
export function useAddWidget() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (device: Pick<Device, 'id' | 'type'>) =>
      unwrap(await api.POST('/api/me/widgets', { body: { kind: widgetKindFor(device), targetType: 'device', targetId: device.id!, config: widgetConfigFor(device) } })),
    onSettled: () => queries.invalidateQueries({ queryKey: ['widgets'] }),
  });
}

/** Removes widgets (all of a device); also reloads when it failed, the server state may have changed. */
export function useRemoveWidgets() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        unwrap(await api.DELETE('/api/me/widgets/{id}', { params: { path: { id } } }));
      }
    },
    onSettled: () => queries.invalidateQueries({ queryKey: ['widgets'] }),
  });
}

/** The new order: the ids of all widgets. */
export function useReorderWidgets() {
  const api = useApi();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (widgetIds: number[]) => unwrap(await api.PUT('/api/me/widgets/order', { body: { widgetIds } })),
    onSettled: () => queries.invalidateQueries({ queryKey: ['widgets'] }),
  });
}

/**
 * One-time takeover of the selection this phone stored before widgets lived on the server (layout.widget): when the
 * server has no widget yet, the stored devices are created there in their order, then the stored list is emptied. A
 * server that has widgets already (another phone was first) is left alone and the stored list is dropped. If the upload
 * breaks off, the stored list stays and the next start creates what is missing (a marker remembers that it began), so
 * nothing is lost and nothing is created twice.
 */
export function useWidgetTakeover(userId: number | undefined, layout: DashboardLayout, loaded: boolean, save: (layout: DashboardLayout) => void, devices: Device[] | undefined) {
  const api = useApi();
  const queries = useQueryClient();
  const attempted = useRef(false);

  useEffect(() => {
    if (userId === undefined || !loaded || !devices || layout.widget.length === 0 || attempted.current) {
      return;
    }
    attempted.current = true;
    void (async () => {
      const marker = await AsyncStorage.getItem(takeoverKey(userId)).catch(() => null);
      const clear = () => save({ ...layout, widget: [] });
      if (marker === 'done') {
        clear();
        return;
      }
      const onServer = unwrap(await api.GET('/api/me/widgets'));
      if (marker !== 'started' && onServer.length > 0) {
        await AsyncStorage.setItem(takeoverKey(userId), 'done').catch(() => undefined);
        clear();
        return;
      }
      await AsyncStorage.setItem(takeoverKey(userId), 'started').catch(() => undefined);
      for (const wanted of widgetsStillToTakeOver(layout.widget, onServer, devices)) {
        unwrap(await api.POST('/api/me/widgets', { body: { kind: wanted.kind, targetType: 'device', targetId: wanted.deviceId, config: wanted.config } }));
      }
      await AsyncStorage.setItem(takeoverKey(userId), 'done').catch(() => undefined);
      clear();
      void queries.invalidateQueries({ queryKey: ['widgets'] });
    })().catch(() => {
      // Offline or refused: the stored selection stays, the next start tries again
    });
  }, [api, devices, layout, loaded, queries, save, userId]);
}
