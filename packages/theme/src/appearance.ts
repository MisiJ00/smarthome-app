/**
 * Colour worlds (design plan v2): presets with an accent gradient, own colours, light/dark/black (AMOLED) and a
 * vivid or calm style. Everything here is pure, so web and app derive exactly the same colours.
 */

import { colors, type Colors } from './tokens';

// ---------- Colour maths (hex #rgb / #rrggbb) ----------

type Rgb = [number, number, number];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** True for #rgb or #rrggbb. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value.trim());
}

function toRgb(hex: string): Rgb {
  let h = hex.trim().slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

/** #rgb or #rrggbb as lower-case #rrggbb. */
function expandHex(hex: string): string {
  return toHex(toRgb(hex));
}

/** `from` mixed with `amount` (0–1) of `to`, as #rrggbb. */
export function mix(from: string, to: string, amount: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]);
}

/** Relative luminance after WCAG 2. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Text colours tried on accent fills: white first, then a near-black. */
export const LIGHT_TEXT = '#ffffff';
export const DARK_TEXT = '#0b0b14';

/**
 * Text colour for the given fills (accent and gradient end): white or near-black, whichever reaches WCAG 4.5 on all
 * of them; if neither does, the one with the better worst case.
 */
export function readableOn(...fills: string[]): string {
  const worst = (text: string) => Math.min(...fills.map((f) => contrast(text, f)));
  if (worst(LIGHT_TEXT) >= 4.5) {
    return LIGHT_TEXT;
  }
  if (worst(DARK_TEXT) >= 4.5) {
    return DARK_TEXT;
  }
  return worst(LIGHT_TEXT) >= worst(DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** `color` moved towards black (light backgrounds) or white (dark ones) until it reaches `ratio` on `background`. */
export function ensureContrast(color: string, background: string, ratio: number): string {
  const towards = luminance(background) > 0.4 ? '#000000' : '#ffffff';
  let result = color;
  for (let step = 1; step <= 20 && contrast(result, background) < ratio; step++) {
    result = mix(color, towards, step * 0.05);
  }
  return result;
}

// ---------- Presets ----------

/** One scheme of a preset: accent and gradient end, the "on" colour, optionally own background tones. */
export interface PaletteTones {
  accent: string;
  accent2: string;
  on: string;
  bg?: string;
  surface?: string;
  surface2?: string;
}

export interface Palette {
  /** German name for the settings page. */
  name: string;
  light: PaletteTones;
  dark: PaletteTones;
}

export const palettes = {
  klassik: {
    name: 'Klassik',
    light: { accent: '#4f46e5', accent2: '#7c3aed', on: '#f59e0b' },
    dark: { accent: '#818cf8', accent2: '#c4b5fd', on: '#fbbf24' },
  },
  neon: {
    name: 'Neon',
    light: { accent: '#0891b2', accent2: '#c026d3', on: '#c026d3', bg: '#f5f3fb', surface2: '#efeaf8' },
    dark: { accent: '#22d3ee', accent2: '#e879f9', on: '#f0abfc', bg: '#0c0716', surface: '#160f26', surface2: '#21183a' },
  },
  sunset: {
    name: 'Sunset',
    light: { accent: '#ea580c', accent2: '#db2777', on: '#f97316', bg: '#fbf6f3', surface2: '#f6ece6' },
    dark: { accent: '#fb923c', accent2: '#f472b6', on: '#fdba74', bg: '#150c0d', surface: '#211416', surface2: '#2e1c1f' },
  },
  lime: {
    name: 'Lime',
    light: { accent: '#65a30d', accent2: '#ca8a04', on: '#84cc16', bg: '#f6f8f1', surface2: '#edf1e4' },
    dark: { accent: '#a3e635', accent2: '#facc15', on: '#bef264', bg: '#0b0f08', surface: '#141a10', surface2: '#1e2618' },
  },
  ozean: {
    name: 'Ozean',
    light: { accent: '#0d9488', accent2: '#2563eb', on: '#06b6d4', bg: '#f2f7f9', surface2: '#e7eff3' },
    dark: { accent: '#2dd4bf', accent2: '#60a5fa', on: '#67e8f9', bg: '#06111a', surface: '#0d1b27', surface2: '#152636' },
  },
  bubblegum: {
    name: 'Bubblegum',
    light: { accent: '#ec4899', accent2: '#a855f7', on: '#f472b6', bg: '#fdf4fa', surface2: '#f8e8f3' },
    dark: { accent: '#f9a8d4', accent2: '#c4b5fd', on: '#f9a8d4', bg: '#140a14', surface: '#221322', surface2: '#2f1c2f' },
  },
} as const satisfies Record<string, Palette>;

export type PaletteId = keyof typeof palettes;
export const paletteIds = Object.keys(palettes) as PaletteId[];

// ---------- Appearance (the user's choice) ----------

export type AppearanceMode = 'system' | 'light' | 'dark' | 'black';
export type AppearanceStyle = 'vivid' | 'calm';
/** The scheme colours are derived for: system resolved, black = AMOLED. */
export type Scheme = 'light' | 'dark' | 'black';

export interface Appearance {
  palette: PaletteId | 'custom';
  /** Only used with palette "custom". */
  custom?: { accent: string; accent2: string };
  mode: AppearanceMode;
  style: AppearanceStyle;
}

export const DEFAULT_APPEARANCE: Appearance = { palette: 'neon', mode: 'system', style: 'vivid' };

const MODES: readonly AppearanceMode[] = ['system', 'light', 'dark', 'black'];
const STYLES: readonly AppearanceStyle[] = ['vivid', 'calm'];

/**
 * An appearance from storage (JSON text or an already parsed value). Anything broken falls back to the default, field
 * by field, so an old or hand-edited value never breaks the interface.
 */
export function parseAppearance(json: unknown): Appearance {
  let value: unknown = json;
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json);
    } catch {
      return { ...DEFAULT_APPEARANCE };
    }
  }
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_APPEARANCE };
  }
  const v = value as Record<string, unknown>;
  const custom = v['custom'] as Record<string, unknown> | undefined;
  const hasCustom = typeof custom === 'object' && custom !== null && isHexColor(custom['accent']) && isHexColor(custom['accent2']);
  let palette: Appearance['palette'] = DEFAULT_APPEARANCE.palette;
  if (v['palette'] === 'custom' && hasCustom) {
    palette = 'custom';
  } else if (typeof v['palette'] === 'string' && (paletteIds as string[]).includes(v['palette'])) {
    palette = v['palette'] as PaletteId;
  }
  const result: Appearance = {
    palette,
    mode: MODES.includes(v['mode'] as AppearanceMode) ? (v['mode'] as AppearanceMode) : DEFAULT_APPEARANCE.mode,
    style: STYLES.includes(v['style'] as AppearanceStyle) ? (v['style'] as AppearanceStyle) : DEFAULT_APPEARANCE.style,
  };
  if (hasCustom) {
    result.custom = { accent: String(custom['accent']).trim(), accent2: String(custom['accent2']).trim() };
  }
  return result;
}

/** The scheme for a mode; `systemDark` is what the system prefers right now. */
export function resolveScheme(mode: AppearanceMode, systemDark: boolean): Scheme {
  if (mode === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return mode;
}

// ---------- Derived colours ----------

/** All colours of the classic set, plus the gradient end, a text-safe accent and the gradient itself. */
export type ThemeColors = Colors & {
  accent2: string;
  /** The accent as text or icon on surfaces (links, active navigation): at least 4.5:1 on surface. */
  accentInk: string;
  /** [accent, accent2] for gradients (buttons, active tiles). */
  gradient: readonly [string, string];
  /** True when accent or accent2 had to be moved for contrast (e.g. an own black accent on black). */
  adjusted: boolean;
};

/** AMOLED: pure black ground, surfaces just lifted off it. */
const BLACK = { bg: '#000000', surface: '#0c0c10', surface2: '#17171d', border: '#26262e' };

/**
 * The colours for a preset (or own colours) in a scheme. Neutral tones (text, ok/warn/danger …) come from the classic
 * set; the preset brings accent, gradient end, "on" and optional ground tones. Soft tints, a readable `accentText`
 * (WCAG 4.5 on accent and accent2; an end that misses it is deepened or lightened) and a text-safe `accentInk` are
 * derived.
 */
export function deriveColors(palette: PaletteId | 'custom', scheme: Scheme, custom?: { accent: string; accent2: string }): ThemeColors {
  const base = colors[scheme === 'light' ? 'light' : 'dark'];
  const tone = scheme === 'light' ? 'light' : 'dark';
  let tones: PaletteTones;
  if (palette === 'custom' && custom && isHexColor(custom.accent) && isHexColor(custom.accent2)) {
    tones = { accent: custom.accent.trim(), accent2: custom.accent2.trim(), on: palettes.klassik[tone].on };
  } else {
    tones = palettes[palette === 'custom' ? 'klassik' : palette][tone];
  }

  let bg = isHexColor(tones.bg) ? tones.bg : base.bg;
  let surface = isHexColor(tones.surface) ? tones.surface : base.surface;
  let surface2 = isHexColor(tones.surface2) ? tones.surface2 : base.surface2;
  let border = tones.bg || tones.surface ? mix(surface2, base.text, scheme === 'light' ? 0.06 : 0.08) : base.border;
  if (scheme === 'black') {
    // A hint of the accent keeps black surfaces from looking dead
    bg = BLACK.bg;
    surface = mix(BLACK.surface, tones.accent, 0.04);
    surface2 = mix(BLACK.surface2, tones.accent, 0.05);
    border = mix(BLACK.border, tones.accent, 0.06);
  }

  // Accent fills must stand out from the ground (3:1, like any UI element): an own black accent in black mode or a
  // white one in light mode is lifted just enough
  const onGround = [ensureContrast(tones.accent, bg, 3), ensureContrast(tones.accent2, bg, 3)] as const;
  // Text on switched-on tiles and buttons sits on the whole gradient: pick white or dark text, and if that still
  // misses 4.5:1 on one end, deepen (or lighten) that end just enough
  const accentText = readableOn(...onGround);
  const accent = ensureContrast(onGround[0], accentText, 4.5);
  const accent2 = ensureContrast(onGround[1], accentText, 4.5);
  // Compared normalised: an own '#fe0' or '#FFEE00' that stayed as it is has not been adjusted
  const adjusted = expandHex(accent) !== expandHex(tones.accent) || expandHex(accent2) !== expandHex(tones.accent2);

  const soft = (color: string, amount: number) => mix(surface, color, amount);
  const light = scheme === 'light';
  const accentSoft = soft(accent, light ? 0.12 : 0.2);
  // "On" fills icon circles: on light surfaces a bright yellow or lime is deepened until it stands out (3:1)
  const on = light ? ensureContrast(tones.on, surface, 3) : tones.on;
  return {
    ...base,
    bg,
    surface,
    surface2,
    border,
    accent,
    accent2,
    accentText,
    // readable on the ground, on cards and on its own tint (active navigation, selected chips), which is the hardest
    accentInk: ensureContrast(ensureContrast(accent, accentSoft, 4.6), bg, 4.6),
    accentSoft,
    on,
    onSoft: soft(on, light ? 0.12 : 0.15),
    okSoft: soft(base.ok, light ? 0.1 : 0.14),
    warnSoft: soft(base.warn, light ? 0.08 : 0.14),
    dangerSoft: soft(base.danger, light ? 0.1 : 0.14),
    overlay: scheme === 'black' ? 'rgba(0, 0, 0, 0.75)' : base.overlay,
    gradient: [accent, accent2],
    adjusted,
  };
}

/** The colours for an appearance, with the system's current preference. */
export function appearanceColors(appearance: Appearance, systemDark: boolean): { scheme: Scheme; colors: ThemeColors } {
  const scheme = resolveScheme(appearance.mode, systemDark);
  return { scheme, colors: deriveColors(appearance.palette, scheme, appearance.custom) };
}

const kebab = (name: string) => name.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);

/**
 * The colours as CSS custom properties for the web (accent2 → --accent-2, accentInk → --accent-ink), plus
 * --gradient (135°) and color-scheme.
 */
export function cssColorVariables(c: ThemeColors, scheme: Scheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(c)) {
    // Strings only: the gradient pair and the adjusted flag are not colours
    if (typeof value === 'string') {
      vars[`--${kebab(name)}`] = value;
    }
  }
  vars['--gradient'] = `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})`;
  vars['color-scheme'] = scheme === 'light' ? 'light' : 'dark';
  return vars;
}
