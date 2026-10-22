import { describe, expect, it } from 'vitest';

import { colors, cssVariables } from './index';

describe('design tokens', () => {
  it('have the same colour names in light and dark', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('become the CSS variables the web interface uses', () => {
    const css = cssVariables();
    expect(css).toContain('--accent-text: #ffffff;');
    expect(css).toContain('--surface-2: #eef1f5;');
    expect(css).toContain('--radius: 14px;');
    expect(css).toContain('--space-lg: 16px;');
    expect(css).toContain(":root[data-theme='dark'] {");
    expect(css).toContain("@media (prefers-color-scheme: dark) { :root:not([data-theme='light'])");
  });
});
