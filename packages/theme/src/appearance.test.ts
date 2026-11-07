import { describe, expect, it } from 'vitest';

import {
  DEFAULT_APPEARANCE,
  appearanceColors,
  colors,
  contrast,
  cssColorVariables,
  deriveColors,
  ensureContrast,
  mix,
  paletteIds,
  palettes,
  parseAppearance,
  readableOn,
  resolveScheme,
  type Scheme,
} from './index';

const schemes: Scheme[] = ['light', 'dark', 'black'];

describe('colour maths', () => {
  it('mixes and measures contrast like WCAG', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#fff', '#000', 0)).toBe('#ffffff');
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('picks white or dark text, whichever is readable', () => {
    expect(readableOn('#4f46e5')).toBe('#ffffff');
    expect(readableOn('#a3e635')).toBe('#0b0b14');
    expect(readableOn('#22d3ee', '#e879f9')).toBe('#0b0b14');
  });

  it('darkens or lightens a colour until it reaches the ratio', () => {
    const ink = ensureContrast('#a3e635', '#ffffff', 4.5);
    expect(contrast(ink, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    const onDark = ensureContrast('#4f46e5', '#000000', 4.5);
    expect(contrast(onDark, '#000000')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('deriveColors', () => {
  it('has the same names as the classic colours, plus gradient, accent2 and accentInk', () => {
    const derived = deriveColors('neon', 'dark');
    for (const name of Object.keys(colors.light)) {
      expect(derived).toHaveProperty(name);
    }
    expect(derived.gradient).toEqual([derived.accent, derived.accent2]);
  });

  it.each(paletteIds.flatMap((id) => schemes.map((s) => [id, s] as const)))('%s/%s: text on accent and accent ink are readable', (id, scheme) => {
    const c = deriveColors(id, scheme);
    // Switched-on tiles put accentText on the gradient, so it must be readable on both ends
    expect(contrast(c.accentText, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentText, c.accent2)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentInk, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(7);
  });

  it('keeps the classic preset close to v1 in light mode', () => {
    const c = deriveColors('klassik', 'light');
    expect(c.accent).toBe(palettes.klassik.light.accent);
    expect(c.bg).toBe(colors.light.bg);
    expect(c.surface).toBe(colors.light.surface);
  });

  it('makes black mode AMOLED: pure black ground, lifted surfaces', () => {
    const c = deriveColors('ozean', 'black');
    expect(c.bg).toBe('#000000');
    expect(c.surface).not.toBe('#000000');
    expect(contrast(c.surface, c.bg)).toBeGreaterThan(1);
  });

  it('uses own colours as they are when they stand out, and switches to dark text on a light accent', () => {
    const dark = deriveColors('custom', 'dark', { accent: '#ffee00', accent2: '#ffaa00' });
    expect(dark.accent).toBe('#ffee00');
    expect(dark.accent2).toBe('#ffaa00');
    expect(dark.accentText).toBe('#0b0b14');
    expect(dark.adjusted).toBe(false);
    // The same yellow on the light ground would vanish: deepened to 3:1
    const light = deriveColors('custom', 'light', { accent: '#ffee00', accent2: '#ffaa00' });
    expect(contrast(light.accent, light.bg)).toBeGreaterThanOrEqual(3);
    expect(light.adjusted).toBe(true);
  });

  it('does not report own colours as adjusted just because they are written as #rgb or in capitals', () => {
    expect(deriveColors('custom', 'dark', { accent: '#fe0', accent2: '#FA0' }).adjusted).toBe(false);
    expect(deriveColors('custom', 'dark', { accent: '#FFEE00', accent2: '#FFAA00' }).adjusted).toBe(false);
    // ... but a really changed colour still is
    expect(deriveColors('custom', 'light', { accent: '#FFEE00', accent2: '#FA0' }).adjusted).toBe(true);
  });

  it('lifts an own accent that would vanish on the ground (black on black, white on light) to 3:1', () => {
    const black = deriveColors('custom', 'black', { accent: '#000000', accent2: '#000000' });
    expect(contrast(black.accent, black.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(black.accent2, black.bg)).toBeGreaterThanOrEqual(3);
    expect(black.adjusted).toBe(true);
    const white = deriveColors('custom', 'light', { accent: '#ffffff', accent2: '#fff' });
    expect(contrast(white.accent, white.bg)).toBeGreaterThanOrEqual(3);
    expect(white.adjusted).toBe(true);
    expect(deriveColors('neon', 'dark').adjusted).toBe(false);
  });

  it('keeps text readable on any own gradient', () => {
    const samples = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#777777', '#ffee00', '#00ffff', '#ff00ff', '#3b3b3b', '#c0c0c0'];
    for (const scheme of schemes) {
      for (const a of samples) {
        for (const b of samples) {
          const c = deriveColors('custom', scheme, { accent: a, accent2: b });
          expect(contrast(c.accentText, c.accent)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(c.accentText, c.accent2)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(c.accent, c.bg)).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('falls back to the classic preset for broken own colours', () => {
    const c = deriveColors('custom', 'dark', { accent: 'red', accent2: '#12' });
    expect(c.accent).toBe(palettes.klassik.dark.accent);
  });
});

describe('appearance', () => {
  it('defaults to neon, system, vivid', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ palette: 'neon', mode: 'system', style: 'vivid' });
  });

  it('parses stored values and repairs garbage field by field', () => {
    expect(parseAppearance('{"palette":"lime","mode":"black","style":"calm"}')).toEqual({ palette: 'lime', mode: 'black', style: 'calm' });
    expect(parseAppearance('not json')).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ palette: 'pink', mode: 'dim', style: 'calm' })).toEqual({ ...DEFAULT_APPEARANCE, style: 'calm' });
    // custom without valid colours is not custom
    expect(parseAppearance({ palette: 'custom', custom: { accent: 'nope', accent2: '#fff' } }).palette).toBe('neon');
    expect(parseAppearance({ palette: 'custom', custom: { accent: '#123456', accent2: '#abcdef' } })).toEqual({
      ...DEFAULT_APPEARANCE,
      palette: 'custom',
      custom: { accent: '#123456', accent2: '#abcdef' },
    });
  });

  it('resolves the system mode', () => {
    expect(resolveScheme('system', true)).toBe('dark');
    expect(resolveScheme('system', false)).toBe('light');
    expect(resolveScheme('black', false)).toBe('black');
    expect(appearanceColors({ ...DEFAULT_APPEARANCE, mode: 'light' }, true).scheme).toBe('light');
  });

  it('becomes CSS variables with the gradient', () => {
    const vars = cssColorVariables(deriveColors('sunset', 'dark'), 'dark');
    expect(vars['--accent-2']).toBe(palettes.sunset.dark.accent2);
    expect(vars['--accent-ink']).toBeDefined();
    expect(vars['--surface-2']).toBeDefined();
    expect(vars['--gradient']).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
    expect(vars['--gradient']).toBe(`linear-gradient(135deg, ${palettes.sunset.dark.accent}, ${palettes.sunset.dark.accent2})`);
    expect(vars['color-scheme']).toBe('dark');
  });
});
