import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The manifest and the files it names are what makes the interface installable
const publicDir = new URL('../public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', publicDir), 'utf8')) as {
  name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('web app manifest', () => {
  it('is standalone and starts at the root', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.name).not.toBe('');
  });

  it('has 192 and 512 icons plus a maskable one, all present', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      expect(existsSync(new URL(icon.src.replace(/^\//, ''), publicDir)), icon.src).toBe(true);
    }
  });

  it('is linked from index.html', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});

describe('service worker', () => {
  const sw = readFileSync(new URL('sw.js', publicDir), 'utf8');

  it('never touches the API or Kratos', () => {
    expect(sw).toContain("startsWith('/api')");
    expect(sw).toContain("startsWith('/kratos')");
  });

  it('only handles GET requests', () => {
    expect(sw).toContain("request.method !== 'GET'");
  });
});
