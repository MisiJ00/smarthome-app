import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { ApiError, createApiClient, unwrap, type ApiClient, type Device } from '@smarthome/api-client';
import { commandIntent, deviceKey, parseLayout, primaryAction, tileStatus } from '@smarthome/core';
import { appearanceColors, parseAppearance, type ThemeColors } from '@smarthome/theme';

import { typeIcon } from '../components/devices/meta';
import { whoami } from '../lib/kratos';
import { loadServer } from '../lib/server';
import { layoutKey } from '../components/devices/useDashboardLayout';

// Everything the widget needs, read without the app's React tree (the widget's task runs headless): the session
// from SecureStore, a JWT from Kratos, the devices from the backend, layout and colours from AsyncStorage.

/** Same keys as lib/auth.tsx and lib/theme.ts. */
const SESSION_KEY = 'smarthome.session';
const APPEARANCE_KEY = 'smarthome.appearance';

export interface WidgetItem {
  id: string;
  deviceId: number;
  name: string;
  status: string;
  icon: ReturnType<typeof typeIcon>;
  on: boolean;
  /** "toggle": a tap switches with `command`; "open": opens the app (locks and other actions that need an approval). */
  tap: { kind: 'toggle'; command: Record<string, unknown> } | { kind: 'open' };
}

export type WidgetData =
  | { kind: 'signedOut' }
  | { kind: 'error'; colors: { light: ThemeColors; dark: ThemeColors } }
  | { kind: 'ok'; items: WidgetItem[]; colors: { light: ThemeColors; dark: ThemeColors } };

/** A client of the backend with a fresh JWT for the stored session; null without (a valid) login, throws when Kratos is unreachable. */
export async function widgetApi(): Promise<ApiClient | null> {
  const [server, session] = await Promise.all([loadServer(), SecureStore.getItemAsync(SESSION_KEY)]);
  if (!server || !session) {
    return null;
  }
  const jwt = (await whoami(server, session))?.tokenized;
  if (!jwt) {
    return null;
  }
  return createApiClient({ baseUrl: server, client: 'widget', getToken: async () => jwt });
}

/** The colour world in light and dark (the launcher picks), as the user chose it in the app. */
export async function loadColors() {
  const appearance = parseAppearance(await AsyncStorage.getItem(APPEARANCE_KEY).catch(() => null));
  return { light: appearanceColors(appearance, false).colors, dark: appearanceColors(appearance, true).colors };
}

/** What a device looks like on the widget and what a tap does. */
export function toItem(device: Device): WidgetItem {
  const action = primaryAction(device);
  // the door and anything else that needs "Wirklich …?" and the fingerprint is done in the app
  const tap =
    action.kind === 'toggle' && !commandIntent(device, action.command).requiresConfirmation && !commandIntent(device, action.command).locked
      ? ({ kind: 'toggle', command: action.command } as const)
      : ({ kind: 'open' } as const);
  return {
    id: deviceKey(device),
    deviceId: device.id ?? 0,
    name: device.name ?? 'Gerät',
    status: tileStatus(device),
    icon: typeIcon(device.type, true),
    on: action.kind === 'toggle' && action.on,
    tap,
  };
}

/**
 * Loads the up to four widget devices (`layout.widget`, in that order) with their current state. Pass `api` when the
 * caller already has a client (saves a round trip to Kratos); without it one is made from the stored session.
 */
export async function loadWidgetData(api?: ApiClient | null): Promise<WidgetData> {
  const colors = await loadColors();
  try {
    const client = api === undefined ? await widgetApi() : api;
    if (!client) {
      return { kind: 'signedOut' };
    }
    const me = unwrap(await client.GET('/api/me'));
    const layout = parseLayout(await AsyncStorage.getItem(layoutKey(me.id ?? 0)));
    const devices = unwrap(await client.GET('/api/devices', {}));
    const byId = new Map(devices.map((d) => [deviceKey(d), d]));
    const items = layout.widget.map((id) => byId.get(id)).filter((d): d is Device => d !== undefined).map(toItem);
    return { kind: 'ok', items, colors };
  } catch (e) {
    // a rejected session is "signed out", everything else (network, server) a temporary error
    return e instanceof ApiError && e.status === 401 ? { kind: 'signedOut' } : { kind: 'error', colors };
  }
}
