import { describe, expect, it } from 'vitest';

import { auditDescription, auditTone, formatTime, roleLabel, type AuditEntry } from './userAdmin';

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
