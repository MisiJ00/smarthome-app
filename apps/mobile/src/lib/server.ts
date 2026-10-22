import * as SecureStore from 'expo-secure-store';

// The app reaches everything through one address, like the web interface: /api is the backend, /kratos the login
// service. Locally that is the web interface's dev server (from the Android emulator http://10.0.2.2:5173), on the
// server the reverse proxy.

const KEY = 'smarthome.server';

/** From the Android emulator, the computer it runs on is 10.0.2.2. */
export const DEV_SERVER = 'http://10.0.2.2:5173';

export async function loadServer(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function saveServer(url: string): Promise<string> {
  const normalized = normalizeServer(url);
  await SecureStore.setItemAsync(KEY, normalized);
  return normalized;
}

/** Adds http(s):// if missing and removes trailing slashes. */
export function normalizeServer(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function webSocketUrl(server: string, path: string): string {
  return server.replace(/^http/i, 'ws') + path;
}
