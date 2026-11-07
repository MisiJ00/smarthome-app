/**
 * Design tokens: the one place for colours, spacing, corner radii, type sizes and icon names. The web interface turns
 * them into CSS variables ({@link cssVariables}, e.g. --accent, --space-md, --font-lg), the phone app uses the values
 * directly in its StyleSheets. A redesign changes this file, and both follow.
 */

export const colors = {
  light: {
    bg: '#f3f5f9',
    surface: '#ffffff',
    surface2: '#eef1f6',
    text: '#151b28',
    muted: '#5f6b7d',
    border: '#e1e5ec',
    accent: '#4f46e5',
    accentText: '#ffffff',
    /** tinted background behind accented things (active navigation, selected chip) */
    accentSoft: '#eceafd',
    /** a device that is switched on (lamp, plug) */
    on: '#f59e0b',
    /** tinted card surface of a device that is switched on */
    onSoft: '#fff6e5',
    ok: '#15803d',
    okSoft: '#e7f6ec',
    warn: '#c2410c',
    warnSoft: '#fdf0e7',
    danger: '#dc2626',
    dangerSoft: '#fdecec',
    /** dimmed backdrop behind dialogs (comma syntax with a 0–1 alpha: React Native reads no percent alpha) */
    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  dark: {
    bg: '#0e131c',
    surface: '#171d29',
    surface2: '#212938',
    text: '#e8ecf3',
    muted: '#97a2b5',
    border: '#2a3343',
    accent: '#818cf8',
    accentText: '#0d1020',
    accentSoft: '#252a4a',
    on: '#fbbf24',
    onSoft: '#2d2616',
    ok: '#4ade80',
    okSoft: '#16291f',
    warn: '#fb923c',
    warnSoft: '#2e2016',
    danger: '#f87171',
    dangerSoft: '#321b1f',
    overlay: 'rgba(2, 6, 12, 0.65)',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorName = keyof (typeof colors)['light'];
export type Colors = Record<ColorName, string>;

/** Spacing in px (gaps, padding, margins). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii in px; md is the radius of buttons and inputs, lg the radius of cards, pill of chips. */
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 } as const;

/** Type sizes in px; md is body text. */
export const fontSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 22, xxl: 28 } as const;

export const fontWeight = { regular: '400', semibold: '600', bold: '700' } as const;

/** Soft shadow of cards on the web; the app uses elevation instead. In dark mode cards stand out by brightness. */
export const shadow = {
  light: '0 1px 2px rgb(16 24 40 / 4%), 0 4px 14px rgb(16 24 40 / 6%)',
  dark: 'none',
} as const;

/** Larger shadow of dialogs, menus and popovers (--shadow-lg). */
export const shadowLg = {
  light: '0 12px 32px rgb(16 24 40 / 14%), 0 2px 6px rgb(16 24 40 / 8%)',
  dark: '0 16px 40px rgb(0 0 0 / 55%), 0 0 0 1px rgb(255 255 255 / 6%)',
} as const;

/**
 * Icon per purpose, as names of the Lucide icon set (lucide-react for the web, lucide-react-native for the app), so
 * both show the same symbol. The web renders them with components/Icon.tsx.
 */
export const icons = {
  light: 'lightbulb',
  plug: 'plug',
  switch: 'toggle-right',
  lock: 'lock',
  unlock: 'lock-open',
  sensor: 'thermometer',
  cover: 'blinds',
  climate: 'heater',
  device: 'cpu',
  room: 'house',
  approval: 'shield-check',
  phone: 'smartphone',
  settings: 'settings',
  admin: 'users',
  logout: 'log-out',
  live: 'radio',
  // Readings and controls
  temperature: 'thermometer',
  humidity: 'droplets',
  battery: 'battery',
  brightness: 'sun',
  power: 'power',
  energy: 'zap',
  motion: 'activity',
  contact: 'door-open',
  heat: 'flame',
  cool: 'snowflake',
  auto: 'gauge',
  fan: 'wind',
  plus: 'plus',
  minus: 'minus',
  // Interface
  home: 'house',
  devices: 'layout-grid',
  account: 'user',
  rights: 'key-round',
  audit: 'scroll-text',
  more: 'ellipsis',
  next: 'chevron-right',
  add: 'plus',
  edit: 'pencil',
  delete: 'trash-2',
  refresh: 'refresh-cw',
  search: 'search',
  check: 'check',
  close: 'x',
  info: 'info',
  warning: 'triangle-alert',
  empty: 'inbox',
  clock: 'clock',
  offline: 'wifi-off',
  themeLight: 'sun',
  themeDark: 'moon',
  themeSystem: 'monitor',
  themeBlack: 'moon-star',
  // Appearance settings (v2)
  appearance: 'palette',
  vivid: 'sparkles',
  calm: 'feather',
  customColor: 'pipette',
  // Dashboard editing (v2): show / hide a tile
  eye: 'eye',
  eyeOff: 'eye-off',
  // Admin pages: sort rows, pairing, newly found devices
  up: 'chevron-up',
  down: 'chevron-down',
  pairing: 'radar',
  found: 'sparkles',
} as const;

export type IconName = keyof typeof icons;

const kebab = (name: string) => name.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);

function variables(scheme: ColorScheme): string {
  const lines = Object.entries(colors[scheme]).map(([name, value]) => `--${kebab(name)}: ${value};`);
  lines.push(`--shadow: ${shadow[scheme]};`, `--shadow-lg: ${shadowLg[scheme]};`, `color-scheme: ${scheme};`);
  return lines.join(' ');
}

function scales(): string {
  const lines = [
    ...Object.entries(space).map(([k, v]) => `--space-${k}: ${v}px;`),
    ...Object.entries(radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
    ...Object.entries(fontSize).map(([k, v]) => `--font-${k}: ${v}px;`),
    `--radius: ${radius.lg}px;`,
  ];
  return lines.join(' ');
}

/**
 * The tokens as CSS: light by default, dark when the system says so, and data-theme="light|dark" on <html> as the
 * user's choice. Colour names become kebab-case (surface2 → --surface-2, accentText → --accent-text).
 */
export function cssVariables(): string {
  return [
    `:root { ${scales()} ${variables('light')} }`,
    `:root[data-theme='dark'] { ${variables('dark')} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${variables('dark')} } }`,
  ].join('\n');
}
