import { useSyncExternalStore } from 'react';

import {
  DEFAULT_APPEARANCE,
  appearanceColors,
  cssColorVariables,
  parseAppearance,
  shadow,
  shadowLg,
  type Appearance,
  type AppearanceMode,
  type IconName,
  type Scheme,
  type ThemeColors,
} from '@smarthome/theme';

/*
 * The appearance at run time: colour world, mode (system/light/dark/black) and style (vivid/calm), remembered in this
 * browser. The derived colours go onto <html> as CSS variables (--accent, --accent-2, --gradient …), plus
 * data-theme="light|dark|black", data-style="vivid|calm" and data-palette for the style sheet.
 */

const KEY = 'smarthome.appearance';
/** v1 only stored light/dark; taken over once. */
const OLD_KEY = 'smarthome.theme';

export function storedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      return parseAppearance(raw);
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old === 'light' || old === 'dark') {
      return { ...DEFAULT_APPEARANCE, mode: old };
    }
  } catch {
    // Private mode: the default
  }
  return { ...DEFAULT_APPEARANCE };
}

export interface AppearanceState {
  appearance: Appearance;
  scheme: Scheme;
  colors: ThemeColors;
}

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;

let state: AppearanceState | undefined;
const listeners = new Set<() => void>();

function compute(appearance: Appearance): AppearanceState {
  return { appearance, ...appearanceColors(appearance, media?.matches ?? false) };
}

function paint({ appearance, scheme, colors }: AppearanceState) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(cssColorVariables(colors, scheme))) {
    root.style.setProperty(name, value);
  }
  const shade = scheme === 'light' ? 'light' : 'dark';
  root.style.setProperty('--shadow', shadow[shade]);
  root.style.setProperty('--shadow-lg', shadowLg[shade]);
  // Also the ground of <html> (index.html paints it before the app loads; overscroll shows it)
  root.style.backgroundColor = colors.bg;
  root.dataset['theme'] = scheme;
  root.dataset['style'] = appearance.style;
  root.dataset['palette'] = appearance.palette;
  // Browser chrome (mobile address bar) in the ground colour
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = colors.bg;
}

function publish(next: AppearanceState) {
  state = next;
  paint(next);
  listeners.forEach((listener) => listener());
}

/** Applies and remembers an appearance; every component using useAppearance follows. */
export function setAppearance(appearance: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(appearance));
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Private mode: only for this visit
  }
  publish(compute(appearance));
}

/** Changes some fields of the current appearance, e.g. `updateAppearance({ mode: 'black' })`. */
export function updateAppearance(change: Partial<Appearance>) {
  setAppearance({ ...current().appearance, ...change });
}

function current(): AppearanceState {
  return (state ??= compute(storedAppearance()));
}

/** Paints the stored appearance before the first render and follows the system's light/dark switch. */
export function initAppearance() {
  publish(current());
  media?.addEventListener('change', () => {
    if (current().appearance.mode === 'system') {
      publish(compute(current().appearance));
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The current appearance with its derived colours and scheme ('light' | 'dark' | 'black'), plus setters. Colours as JS
 * values are for places CSS variables do not reach (canvas, charts, colour pickers).
 */
export function useAppearance(): AppearanceState & { setAppearance: typeof setAppearance; updateAppearance: typeof updateAppearance } {
  const snapshot = useSyncExternalStore(subscribe, current);
  return { ...snapshot, setAppearance, updateAppearance };
}

// The quick switch in the side bar and header cycles through the modes
export const nextMode: Record<AppearanceMode, AppearanceMode> = { system: 'light', light: 'dark', dark: 'black', black: 'system' };
export const modeName: Record<AppearanceMode, string> = { system: 'System', light: 'Hell', dark: 'Dunkel', black: 'Schwarz' };
export const modeLabel: Record<AppearanceMode, string> = {
  system: 'Design: System',
  light: 'Design: Hell',
  dark: 'Design: Dunkel',
  black: 'Design: Schwarz',
};
export const modeIcon: Record<AppearanceMode, IconName> = { system: 'themeSystem', light: 'themeLight', dark: 'themeDark', black: 'themeBlack' };
