import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS, AUDIT_RESULTS, auditDescription, auditTone, formatTime, roleLabel, type AuditEntry } from './userAdmin';

describe('role labels', () => {
  it('names the system roles in German and leaves custom ones as they are', () => {
    expect(roleLabel('bewohner')).toBe('Bewohner');
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('nachbar')).toBe('nachbar');
    expect(roleLabel(undefined)).toBe('');
  });
});

describe('formatTime', () => {
  it('shows a dash without a time and a German date with one', () => {
    expect(formatTime(undefined)).toBe('–');
    expect(formatTime('2026-11-07T18:11:04Z')).toMatch(/^\d{2}\.\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}$/);
  });
});

describe('audit entries', () => {
  const entry = (patch: Partial<AuditEntry>): AuditEntry => ({ action: 'unlock', params: {}, result: 'sent', ...patch });

  it('describes commands with their values and who approved them', () => {
    expect(auditDescription(entry({ action: 'control', params: { state: 'ON' } }))).toContain('state: ON');
    expect(auditDescription(entry({ params: { state: 'UNLOCK', requestedBy: 'Erika', approvedWith: 'Pixel' } }))).toBe(
      `${auditDescription(entry({ params: { state: 'UNLOCK' } }))} · per Pixel`,
    );
  });

  it('knows pairing and registered devices', () => {
    expect(auditDescription(entry({ action: 'permit_join', params: { seconds: 254 } }))).toBe('Anlernmodus (254 s)');
    expect(auditDescription(entry({ action: 'trusted_device', params: { name: 'Pixel' } }))).toBe('Handy Pixel');
    expect(auditDescription(entry({ action: 'trusted_device', params: { name: 'Laptop', kind: 'webauthn' } }))).toBe('Browser Laptop');
  });

  it('colours results: done is green, refused red, waiting amber', () => {
    expect(auditTone('approved')).toBe('ok');
    expect(auditTone('denied')).toBe('error');
    expect(auditTone('pending')).toBe('warn');
    expect(auditTone('registered')).toBeUndefined();
  });
});

describe('SSO entries', () => {
  const sso = (patch: Partial<AuditEntry>): AuditEntry => ({
    action: 'sso_login',
    result: 'accepted',
    params: { clientId: 'immich', clientName: 'Immich' },
    ...patch,
  });

  it('reads sign-ins, consents and logouts in German', () => {
    expect(auditDescription(sso({}))).toBe('Anmeldung bei Immich');
    expect(auditDescription(sso({ result: 'rejected', params: { clientId: 'immich', clientName: 'Immich', reason: 'deactivated' } }))).toBe(
      'Anmeldung bei Immich abgelehnt (Konto deaktiviert)',
    );
    expect(auditDescription(sso({ action: 'sso_consent', params: { clientName: 'Immich', scopes: ['openid', 'email'] } }))).toBe(
      'Zustimmung für Immich erteilt: Identität, E-Mail',
    );
    expect(auditDescription(sso({ action: 'sso_consent', result: 'skipped', params: { clientName: 'Immich', reason: 'trusted', scopes: ['openid'] } }))).toBe(
      'Zustimmung für Immich übersprungen (vertrauenswürdiger Dienst): Identität',
    );
    expect(auditDescription(sso({ action: 'sso_consent', result: 'rejected', params: { clientName: 'Immich', reason: 'refused' } }))).toBe(
      'Zustimmung für Immich abgelehnt',
    );
    expect(auditDescription(sso({ action: 'sso_logout' }))).toBe('Abmeldung bei Immich');
    expect(auditDescription(sso({ action: 'sso_logout', result: 'rejected' }))).toBe('Abmeldung bei Immich abgelehnt');
  });

  it('falls back to the client id and shows the text as it is', () => {
    expect(auditDescription(sso({ params: { clientId: 'dev-sso-client', clientName: '' } }))).toBe('Anmeldung bei dev-sso-client');
    expect(auditDescription(sso({ params: { clientName: '<b>Dienst</b>' } }))).toBe('Anmeldung bei <b>Dienst</b>');
  });

  it('has labels for the new results and the SSO filters', () => {
    expect(AUDIT_RESULTS.accepted).toBe('angenommen');
    expect(AUDIT_RESULTS.skipped).toBe('übersprungen');
    expect(AUDIT_ACTIONS['sso_login']).toBe('SSO-Anmeldung');
    expect(auditTone('accepted')).toBe('ok');
    expect(auditTone('skipped')).toBeUndefined();
  });
});
