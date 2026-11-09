import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, unwrap, type ApiClient } from '@smarthome/api-client';
import { deviceItem, staleItems, unavailableItem, type HomescreenItem } from '@smarthome/core';
import type { ThemeColors } from '@smarthome/theme';

import { loadColors, widgetApi } from './data';

// The single device widgets ("Einzelgerät"): every instance on the home screen shows one device the person chose when
// adding it. Which device belongs to which instance is stored here on the phone, by the instance's widget id and the
// device's id (never a position): the id of the device and the last tile that was drawn (name and state, nothing
// secret) for when the server cannot be reached. The device itself comes from the device API, so these widgets are
// not part of the quick switch's list on the server.

export const SINGLE_WIDGET_NAME = 'SingleDevice';

const KEY = (widgetId: number) => `smarthome.widget.single.${widgetId}`;
const KEY_PREFIX = 'smarthome.widget.single.';

interface Binding {
  deviceId: number;
  last?: HomescreenItem;
}

export type SingleData =
  | { kind: 'signedOut' }
  | { kind: 'unset'; colors: { light: ThemeColors; dark: ThemeColors } }
  | { kind: 'error'; colors: { light: ThemeColors; dark: ThemeColors } }
  | { kind: 'ok'; item: HomescreenItem; colors: { light: ThemeColors; dark: ThemeColors } };

async function readBinding(widgetId: number): Promise<Binding | undefined> {
  try {
    const raw = JSON.parse((await AsyncStorage.getItem(KEY(widgetId))) ?? 'null') as Partial<Binding> | null;
    return raw && typeof raw.deviceId === 'number' ? { deviceId: raw.deviceId, last: raw.last } : undefined;
  } catch {
    return undefined;
  }
}

/** The device an instance shows, or undefined while none is chosen. */
export async function singleDeviceOf(widgetId: number): Promise<number | undefined> {
  return (await readBinding(widgetId))?.deviceId;
}

/** Chooses the device of an instance (also when it is changed later); the last drawn tile belonged to the old one. */
export async function bindSingleDevice(widgetId: number, deviceId: number): Promise<void> {
  await AsyncStorage.setItem(KEY(widgetId), JSON.stringify({ deviceId } satisfies Binding));
}

/** The instance was removed: its assignment goes with it. */
export async function unbindSingleDevice(widgetId: number): Promise<void> {
  await AsyncStorage.removeItem(KEY(widgetId)).catch(() => undefined);
}

/** Drops the assignments of instances that are not on the home screen any more (removed while the app could not run). */
export async function pruneSingleBindings(existing: number[]): Promise<void> {
  try {
    const keep = new Set(existing.map(KEY));
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX) && !keep.has(k));
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
  } catch {
    // an unreadable store only means stale assignments stay a little longer
  }
}

/** Signing out: no device names left behind. */
export async function forgetSingleTiles(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX));
    for (const key of keys) {
      const binding = await readBinding(Number(key.slice(KEY_PREFIX.length)));
      if (binding) {
        await AsyncStorage.setItem(key, JSON.stringify({ deviceId: binding.deviceId } satisfies Binding));
      }
    }
  } catch {
    // see above
  }
}

/** Remembers the tile that was just drawn for the offline case. */
export async function rememberSingle(widgetId: number, item: HomescreenItem): Promise<void> {
  const binding = await readBinding(widgetId);
  if (binding && binding.deviceId === item.deviceId) {
    await AsyncStorage.setItem(KEY(widgetId), JSON.stringify({ deviceId: binding.deviceId, last: item } satisfies Binding)).catch(() => undefined);
  }
}

/**
 * Loads what an instance shows. Without an assignment: "unset". No session: "signedOut". A device the person may not
 * see (the device API answers 404): the neutral tile. The server cannot be reached: the last tile as "Offline", without
 * one an error notice.
 */
export async function loadSingle(widgetId: number, api?: ApiClient | null): Promise<SingleData> {
  const colors = await loadColors();
  const binding = await readBinding(widgetId);
  if (!binding) {
    return { kind: 'unset', colors };
  }
  try {
    const client = api === undefined ? await widgetApi() : api;
    if (!client) {
      return { kind: 'signedOut' };
    }
    const item = deviceItem(unwrap(await client.GET('/api/devices/{id}', { params: { path: { id: binding.deviceId } } })));
    void rememberSingle(widgetId, item);
    return { kind: 'ok', item, colors };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return { kind: 'signedOut' };
    }
    if (e instanceof ApiError && e.status === 404) {
      return { kind: 'ok', item: unavailableItem(binding.deviceId), colors };
    }
    return binding.last && binding.last.deviceId === binding.deviceId
      ? { kind: 'ok', item: staleItems([binding.last])[0]!, colors }
      : { kind: 'error', colors };
  }
}
