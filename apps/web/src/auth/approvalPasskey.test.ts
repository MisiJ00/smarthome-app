import { describe, expect, it } from 'vitest';

import { approvalCreationOptions, approvalRequestOptions } from './approvalPasskey';

// The security of approvals rests on these options: a platform authenticator, a gesture every time, ES256 only

describe('options for registering a browser for approvals', () => {
  const options = approvalCreationOptions({
    challenge: 'AQID',
    rpId: 'home.example.org',
    rpName: 'Smart Home',
    userHandle: 'BAUG',
    userName: 'Erika (Freigabe)',
    excludeCredentialIds: ['BwgJ'],
  });

  it('asks for a platform authenticator and requires user verification', () => {
    expect(options.authenticatorSelection).toMatchObject({ authenticatorAttachment: 'platform', userVerification: 'required' });
  });

  it('offers only ES256 and no attestation', () => {
    expect(options.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }]);
    expect(options.attestation).toBe('none');
  });

  it('passes the server challenge, relying party and user handle on, decoded', () => {
    expect([...new Uint8Array(options.challenge as ArrayBuffer)]).toEqual([1, 2, 3]);
    expect(options.rp).toEqual({ id: 'home.example.org', name: 'Smart Home' });
    expect([...new Uint8Array(options.user.id as ArrayBuffer)]).toEqual([4, 5, 6]);
    expect([...new Uint8Array(options.excludeCredentials?.[0]?.id as ArrayBuffer)]).toEqual([7, 8, 9]);
  });

  it('refuses an incomplete answer of the server', () => {
    expect(() => approvalCreationOptions({ challenge: 'AQID' })).toThrow();
  });
});

describe('options for signing an approval', () => {
  const challenge = new Uint8Array([9, 9]).buffer;
  const options = approvalRequestOptions(challenge, 'BAUG');

  it('allows only the registered credential and requires a gesture', () => {
    expect(options.userVerification).toBe('required');
    expect(options.allowCredentials).toHaveLength(1);
    expect([...new Uint8Array(options.allowCredentials?.[0]?.id as ArrayBuffer)]).toEqual([4, 5, 6]);
    expect(options.challenge).toBe(challenge);
  });
});
