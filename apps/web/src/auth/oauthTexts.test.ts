import { describe, expect, it } from 'vitest';

import { safeRedirect, scopeText, sortScopes } from './oauthTexts';

describe('scope texts', () => {
  it('explains the usual scopes in German and does not hide unknown ones', () => {
    expect(scopeText('email').title).toBe('E-Mail-Adresse');
    expect(scopeText('offline_access').title).toBe('Angemeldet bleiben');
    expect(scopeText('files').title).toBe('files');
  });

  it('puts the identity first and unknown scopes last', () => {
    expect(sortScopes(['files', 'email', 'openid', 'profile'])).toEqual(['openid', 'profile', 'email', 'files']);
  });
});

describe('redirects from the backend', () => {
  it('follows http and https only', () => {
    expect(safeRedirect('https://immich.example.org/auth/callback?code=1')).toBe('https://immich.example.org/auth/callback?code=1');
    expect(safeRedirect('http://localhost:4444/oauth2/auth?x=1')).toContain('localhost:4444');
    expect(safeRedirect('javascript:alert(1)')).toBeUndefined();
    expect(safeRedirect('data:text/html,hi')).toBeUndefined();
    expect(safeRedirect('not a url')).toBeUndefined();
    expect(safeRedirect(undefined)).toBeUndefined();
  });
});
