import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { deriveColors, paletteIds } from '@smarthome/theme';

// index.html paints the ground before the app loads; its table must match the derived colours
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const table = /var grounds = (\{[\s\S]*?\n\s*\});/.exec(html)?.[1];

describe('first paint in index.html', () => {
  it('has a ground colour for every colour world', () => {
    expect(table).toBeDefined();
    const grounds = new Function(`return ${table}`)() as Record<'light' | 'dark', Record<string, string>>;
    for (const scheme of ['light', 'dark'] as const) {
      for (const id of [...paletteIds, 'custom' as const]) {
        expect(grounds[scheme][id], `${scheme}/${id}`).toBe(deriveColors(id, scheme).bg);
      }
    }
    expect(deriveColors('neon', 'black').bg).toBe('#000000');
  });
});
