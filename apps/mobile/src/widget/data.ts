import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { ApiError, createApiClient, unwrap, type ApiClient } from '@smarthome/api-client';
import { homescreenItems, staleItems, type HomescreenItem } from '@smarthome/core';
import { appearanceColors, parseAppearance, type ThemeColors } from '@smarthome/theme';

import { whoami } from '../lib/kratos';
import { loadServer } from '../lib/server';

// Everything the widget needs, read without the app's React tree (the widget's task runs headless): the session
// from SecureStore, a JWT from Kratos, the widgets from the backend (/api/me/widgets/data) and the colours from
// AsyncStorage. The selection itself lives on the server.

/** Same keys as lib/auth.tsx and lib/theme.ts. */
const SESSION_KEY = 'smarthome.session';
const APPEARANCE_KEY = 'smarthome.appearance';
/** The last tiles drawn (names and states, nothing secret), for when the server cannot be reached. */
const LAST_TILES_KEY = 'smarthome.widget.last';

export type WidgetData =
  | { kind: 'signedOut' }
  | { kind: 'error'; colors: { light: ThemeColors; dark: ThemeColors } }
  | { kind: 'ok'; items: HomescreenItem[]; colors: { light: ThemeColors; dark: ThemeColors } };

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

/** Remembers the tiles that were just drawn; a failing write only means no offline fallback. */
export async function rememberTiles(items: HomescreenItem[]): Promise<void> {
  await AsyncStorage.setItem(LAST_TILES_KEY, JSON.stringify(items)).catch(() => undefined);
}

/** Forgets them (signing out): no device names left behind. */
export async function forgetTiles(): Promise<void> {
  await AsyncStorage.removeItem(LAST_TILES_KEY).catch(() => undefined);
}

async function lastTiles(): Promise<HomescreenItem[] | undefined> {
  try {
    const raw = JSON.parse((await AsyncStorage.getItem(LAST_TILES_KEY)) ?? 'null') as unknown;
    return Array.isArray(raw) ? (raw as HomescreenItem[]).slice(0, 4) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads the tiles: the person's widgets from the server in its order, the first four the widget can draw. Pass `api`
 * when the caller already has a client (saves a round trip to Kratos). When the server cannot be reached the last
 * known tiles come back as "Offline" (no state, no switching); without any, an error notice.
 */
export async function loadWidgetData(api?: ApiClient | null): Promise<WidgetData> {
  const colors = await loadColors();
  try {
    const client = api === undefined ? await widgetApi() : api;
    if (!client) {
      return { kind: 'signedOut' };
    }
    const data = unwrap(await client.GET('/api/me/widgets/data'));
    const items = homescreenItems(data.widgets);
    void rememberTiles(items);
    return { kind: 'ok', items, colors };
  } catch (e) {
    // a rejected session is "signed out", everything else (network, server) a temporary error
    if (e instanceof ApiError && e.status === 401) {
      return { kind: 'signedOut' };
    }
    const last = await lastTiles();
    return last && last.length > 0 ? { kind: 'ok', items: staleItems(last), colors } : { kind: 'error', colors };
  }
}
