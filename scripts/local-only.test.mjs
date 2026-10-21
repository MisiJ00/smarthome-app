import { describe, expect, it } from 'vitest';

import { isLocal } from './local-only.mjs';

describe('dev seed only runs locally', () => {
  it('accepts the local stack', () => {
    expect(isLocal('http://localhost:4433')).toBe(true);
    expect(isLocal('http://127.0.0.1:8088')).toBe(true);
    expect(isLocal('http://[::1]:8088')).toBe(true);
  });

  it('refuses everything else, including look-alikes', () => {
    expect(isLocal('https://auth.example.de')).toBe(false);
    expect(isLocal('http://localhost.example.de:4433')).toBe(false);
    expect(isLocal('http://192.168.178.10:4433')).toBe(false);
    expect(isLocal('not a url')).toBe(false);
  });
});
