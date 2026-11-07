import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance as SystemAppearance, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import {
  DEFAULT_APPEARANCE,
  deriveColors,
  parseAppearance,
  resolveScheme,
  type Appearance,
  type AppearanceMode,
  type ColorScheme,
  type IconName,
  type Scheme,
  type ThemeColors,
} from '@smarthome/theme';

// Colours, spacing, radii, type sizes and icon names come from packages/theme, like the CSS variables of the web.
export { fontSize, fontWeight, icons, radius, space, type Colors, type IconName, type ThemeColors } from '@smarthome/theme';

/**
 * Inter per weight. On Android a custom font needs one family per weight; set `fontFamily: fonts.semibold` instead
 * of `fontWeight` (with fontWeight Android may fall back to the system font).
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/** fontWeight values ('400' … '700', as in `fontWeight` of the theme) to the Inter family of that weight. */
const familyByWeight: Record<string, string> = {
  '400': fonts.regular,
  '500': fonts.medium,
  '600': fonts.semibold,
  '700': fonts.bold,
  '800': fonts.extrabold,
};

/**
 * Inter in a weight, as a style: `fontStyle('semibold')` or `fontStyle(fontWeight.semibold)` gives
 * `{ fontFamily: 'Inter_600SemiBold' }`. Use it instead of `fontWeight`.
 */
export function fontStyle(weight: keyof typeof fonts | '400' | '500' | '600' | '700' | '800' = 'regular'): TextStyle {
  return { fontFamily: weight in fonts ? fonts[weight as keyof typeof fonts] : (familyByWeight[weight] ?? fonts.regular) };
}

/** The font files for useFonts (loaded in app/_layout.tsx before the splash screen hides). */
export const fontFiles = {
  [fonts.regular]: Inter_400Regular,
  [fonts.medium]: Inter_500Medium,
  [fonts.semibold]: Inter_600SemiBold,
  [fonts.bold]: Inter_700Bold,
  [fonts.extrabold]: Inter_800ExtraBold,
};

// ---------- Appearance: colour world, mode (system/light/dark/black) and style (vivid/calm) ----------

const KEY = 'smarthome.appearance';

export interface AppearanceState {
  appearance: Appearance;
  /** 'light' | 'dark' | 'black' (AMOLED). */
  scheme: Scheme;
  /** Light or dark: black counts as dark (status bar, shadows). */
  shade: ColorScheme;
  colors: ThemeColors;
  /** False until the stored choice is read; the splash screen waits for it. */
  ready: boolean;
  setAppearance: (appearance: Appearance) => void;
  updateAppearance: (change: Partial<Appearance>) => void;
}

const AppearanceContext = createContext<AppearanceState | null>(null);

/**
 * Holds the chosen appearance (stored in AsyncStorage like the web stores it in localStorage) and derives the colours.
 * A forced mode is also handed to Android (Appearance.setColorScheme), so system dialogs, the keyboard and the
 * navigation bar match the app.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);
  const system = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!cancelled && raw) {
          setState(parseAppearance(raw));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scheme = resolveScheme(appearance.mode, system === 'dark');
  useEffect(() => {
    SystemAppearance.setColorScheme(appearance.mode === 'system' ? 'unspecified' : scheme === 'light' ? 'light' : 'dark');
  }, [appearance.mode, scheme]);

  const setAppearance = useCallback((next: Appearance) => {
    setState(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  const updateAppearance = useCallback(
    (change: Partial<Appearance>) =>
      setState((old) => {
        const next = { ...old, ...change };
        void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }),
    [],
  );

  const value = useMemo<AppearanceState>(
    () => ({
      appearance,
      scheme,
      shade: scheme === 'light' ? 'light' : 'dark',
      colors: deriveColors(appearance.palette, scheme, appearance.custom),
      ready,
      setAppearance,
      updateAppearance,
    }),
    [appearance, scheme, ready, setAppearance, updateAppearance],
  );
  return createElement(AppearanceContext.Provider, { value }, children);
}

/** Outside the provider (should not happen): the default appearance with the system's light/dark. */
function useFallback(): AppearanceState {
  const system = useColorScheme();
  return useMemo(() => {
    const scheme = resolveScheme(DEFAULT_APPEARANCE.mode, system === 'dark');
    return {
      appearance: DEFAULT_APPEARANCE,
      scheme,
      shade: scheme === 'light' ? 'light' : 'dark',
      colors: deriveColors(DEFAULT_APPEARANCE.palette, scheme),
      ready: true,
      setAppearance: () => {},
      updateAppearance: () => {},
    };
  }, [system]);
}

/** The appearance, its scheme and derived colours, and setters (for the appearance screen and the quick switch). */
export function useAppearance(): AppearanceState {
  const fallback = useFallback();
  return useContext(AppearanceContext) ?? fallback;
}

/** Light or dark (black counts as dark), e.g. for `cardShadow[useScheme()]`. */
export function useScheme(): ColorScheme {
  return useAppearance().shade;
}

/** The colours of the chosen colour world and mode; every screen using it follows a change at once. */
export function useColors(): ThemeColors {
  return useAppearance().colors;
}

/** True when the vivid style is on (gradients, glow); calm draws flat tinted surfaces. */
export function useVivid(): boolean {
  return useAppearance().appearance.style === 'vivid';
}

/** German names of the modes, for settings and the quick switch. */
export const modeNames: Record<AppearanceMode, string> = { system: 'System', light: 'Hell', dark: 'Dunkel', black: 'Schwarz' };
/** The quick switch cycles System → Hell → Dunkel → Schwarz. */
export const nextMode: Record<AppearanceMode, AppearanceMode> = { system: 'light', light: 'dark', dark: 'black', black: 'system' };
export const modeIcons: Record<AppearanceMode, IconName> = { system: 'themeSystem', light: 'themeLight', dark: 'themeDark', black: 'themeBlack' };

/** `#rrggbb` as rgba() with a 0–1 alpha (React Native reads no percent alpha). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Glow in a colour (vivid style), as a boxShadow style; nothing when calm. */
export function glowShadow(color: string, vivid: boolean): ViewStyle {
  return vivid ? { boxShadow: `0 8px 20px -6px ${withAlpha(color, 0.6)}` } : {};
}

/**
 * Soft shadow of cards like on the web; in dark mode cards stand out by brightness, so none. (React Native reads
 * only a 0–1 alpha, hence rgba with commas.)
 */
export const cardShadow: Record<ColorScheme, ViewStyle> = {
  light: { boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05), 0 4px 14px rgba(16, 24, 40, 0.07)' },
  dark: {},
};

/** Larger shadow of sheets, dialogs and toasts. */
export const raisedShadow: Record<ColorScheme, ViewStyle> = {
  light: { boxShadow: '0 12px 32px rgba(16, 24, 40, 0.16), 0 2px 6px rgba(16, 24, 40, 0.08)' },
  dark: { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)' },
};
