import { describe, expect, it } from 'vitest';

import { colors, cssVariables, radius } from './index';

describe('design tokens', () => {
  it('have the same colour names in light and dark', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('have the radii of the design plan', () => {
    expect(radius).toEqual({ sm: 10, md: 14, lg: 22, pill: 999 });
  });

  it('become the CSS variables the web interface uses', () => {
    const css = cssVariables();
    expect(css).toContain('--accent-text: #ffffff;');
    expect(css).toContain(`--surface-2: ${colors.light.surface2};`);
    expect(css).toContain('--radius: 22px;');
    expect(css).toContain('--radius-md: 14px;');
    expect(css).toContain('--space-lg: 16px;');
    expect(css).toContain(":root[data-theme='dark'] {");
    expect(css).toContain("@media (prefers-color-scheme: dark) { :root:not([data-theme='light'])");
  });

  it('include the tinted surfaces, the overlay and the large shadow', () => {
    const css = cssVariables();
    for (const name of ['accent-soft', 'on-soft', 'ok-soft', 'warn-soft', 'danger-soft', 'overlay', 'shadow-lg']) {
      expect(css).toContain(`--${name}: `);
    }
  });
});
