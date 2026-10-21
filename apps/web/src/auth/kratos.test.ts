import { describe, expect, it } from 'vitest';

import { csrfToken, jwtExpiry, messages, type Flow } from './kratos';
import { errorTexts } from './texts';

const flow: Flow = {
  id: 'f1',
  ui: {
    messages: [{ id: 4000006, text: 'The provided credentials are invalid', type: 'error' }],
    nodes: [
      { attributes: { name: 'csrf_token', value: 'abc' } },
      { attributes: { name: 'identifier' }, messages: [{ id: 9, text: 'Property identifier is missing', type: 'error' }] },
      { attributes: { name: 'password' } },
    ],
  },
};

describe('kratos helpers', () => {
  it('finds the CSRF token of a flow', () => {
    expect(csrfToken(flow)).toBe('abc');
  });

  it('collects general and field messages, the known ones in German', () => {
    expect(messages(flow).map((m) => m.id)).toEqual([4000006, 9]);
    expect(errorTexts(messages(flow))).toEqual([
      'E-Mail, Benutzername oder Passwort stimmt nicht.',
      'Property identifier is missing',
    ]);
  });

  it('reads the expiry of a JWT', () => {
    const payload = btoa(JSON.stringify({ sub: 'x', exp: 1_800_000_000 })).replace(/=+$/, '');
    expect(jwtExpiry(`eyJhbGciOiJFUzI1NiJ9.${payload}.sig`)).toBe(1_800_000_000);
  });
});
