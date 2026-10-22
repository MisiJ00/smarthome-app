/**
 * Design tokens: the one place for colours, spacing, corner radii, type sizes and icon names. The web interface turns
 * them into CSS variables ({@link cssVariables}, e.g. --accent, --space-md, --font-lg), the phone app uses the values
 * directly in its StyleSheets. A redesign changes this file, and both follow.
 */

export const colors = {
  light: {
    bg: '#f4f6f9',
    surface: '#ffffff',
    surface2: '#eef1f5',
    text: '#17202b',
    muted: '#5d6877',
    border: '#dde2e9',
    accent: '#2f6fde',
    accentText: '#ffffff',
    /** a device that is switched on (lamp, plug) */
    on: '#f5b13d',
    ok: '#1f8a4c',
    warn: '#c2410c',
    danger: '#c62828',
  },
  dark: {
    bg: '#0f141b',
    surface: '#171e27',
    surface2: '#202935',
    text: '#e7ecf2',
    muted: '#98a3b3',
    border: '#2a3441',
    accent: '#5b8ff0',
    accentText: '#0b1220',
    on: '#f5b13d',
    ok: '#4ade80',
    warn: '#fb923c',
    danger: '#f87171',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorName = keyof (typeof colors)['light'];
export type Colors = Record<ColorName, string>;

/** Spacing in px (gaps, padding, margins). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii in px; lg is the radius of cards. */
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

/** Type sizes in px; md is body text. */
export const fontSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 22, xxl: 28 } as const;

export const fontWeight = { regular: '400', semibold: '600', bold: '700' } as const;

/** Shadow of cards on the web; the app uses elevation instead, dark mode has none. */
export const shadow = {
  light: '0 1px 2px rgb(16 24 40 / 6%), 0 1px 3px rgb(16 24 40 / 8%)',
  dark: 'none',
} as const;

/**
 * Icon per purpose, as names of the Lucide icon set (lucide-react for the web, lucide-react-native for the app), so
 * both show the same symbol. Not rendered yet; the redesign picks them up.
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
} as const;

export type IconName = keyof typeof icons;

const kebab = (name: string) => name.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);

function variables(scheme: ColorScheme): string {
  const lines = Object.entries(colors[scheme]).map(([name, value]) => `--${kebab(name)}: ${value};`);
  lines.push(`--shadow: ${shadow[scheme]};`, `color-scheme: ${scheme};`);
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
