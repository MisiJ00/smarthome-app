import { describe, expect, it } from 'vitest';

import { assertionJson, attestationJson, base64urlToBytes, bytesToBase64url, creationOptions, requestOptions } from './webauthn';
import { passkeysOf } from '../pages/PasskeySettings';
import type { Flow } from './kratos';

const buf = (...bytes: number[]) => new Uint8Array(bytes).buffer;

describe('base64url', () => {
  it('round-trips bytes including the URL-safe characters', () => {
    const bytes = buf(0xfb, 0xff, 0xfe, 0x00, 0x01);
    const text = bytesToBase64url(bytes);
    expect(text).toBe('-__-AAE');
    expect([...new Uint8Array(base64urlToBytes(text))]).toEqual([0xfb, 0xff, 0xfe, 0x00, 0x01]);
  });

  it('treats missing data as empty', () => {
    expect(bytesToBase64url(null)).toBe('');
  });
});

describe('options from Kratos', () => {
  it('decodes the challenge and credential ids of a sign-in', () => {
    const options = requestOptions({
      publicKey: { challenge: 'AQID', rpId: 'localhost', allowCredentials: [{ id: 'BAUG', type: 'public-key' }] },
    });
    expect([...new Uint8Array(options.challenge as ArrayBuffer)]).toEqual([1, 2, 3]);
    expect(options.rpId).toBe('localhost');
    expect([...new Uint8Array(options.allowCredentials?.[0]?.id as ArrayBuffer)]).toEqual([4, 5, 6]);
  });

  it('leaves allowCredentials out for discoverable sign-in', () => {
    expect(requestOptions({ publicKey: { challenge: 'AQID' } })).not.toHaveProperty('allowCredentials');
  });

  it('decodes challenge, user id and excluded credentials of a registration', () => {
    const options = creationOptions({
      publicKey: {
        challenge: 'AQID',
        rp: { name: 'Smart Home', id: 'localhost' },
        user: { id: 'BAUG', name: 'erika', displayName: 'Erika' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        excludeCredentials: [{ id: 'BwgJ', type: 'public-key' }],
      },
    });
    expect([...new Uint8Array(options.user.id as ArrayBuffer)]).toEqual([4, 5, 6]);
    expect(options.user.name).toBe('erika');
    expect([...new Uint8Array(options.excludeCredentials?.[0]?.id as ArrayBuffer)]).toEqual([7, 8, 9]);
  });
});

describe('answers for Kratos', () => {
  const base = { id: 'abc', rawId: buf(1, 2), type: 'public-key' };

  it('serialises a sign-in', () => {
    const credential = {
      ...base,
      response: { authenticatorData: buf(1), clientDataJSON: buf(2), signature: buf(3), userHandle: buf(4) },
    } as unknown as PublicKeyCredential;
    expect(JSON.parse(assertionJson(credential))).toEqual({
      id: 'abc',
      rawId: 'AQI',
      type: 'public-key',
      response: { authenticatorData: 'AQ', clientDataJSON: 'Ag', signature: 'Aw', userHandle: 'BA' },
    });
  });

  it('serialises a registration', () => {
    const credential = { ...base, response: { attestationObject: buf(5), clientDataJSON: buf(6) } } as unknown as PublicKeyCredential;
    expect(JSON.parse(attestationJson(credential))).toEqual({
      id: 'abc',
      rawId: 'AQI',
      type: 'public-key',
      response: { attestationObject: 'BQ', clientDataJSON: 'Bg' },
    });
  });
});

describe('passkey list in the settings flow', () => {
  it('reads name and date from the remove buttons', () => {
    const flow: Flow = {
      id: 'f',
      ui: {
        nodes: [
          { attributes: { name: 'passkey_register_trigger' } },
          {
            attributes: { name: 'passkey_remove', value: 'cred1' },
            meta: { label: { text: 'Remove', context: { display_name: 'Pixel', added_at: '2026-11-07T10:00:00Z' } } },
          },
        ],
      },
    };
    expect(passkeysOf(flow)).toEqual([{ id: 'cred1', name: 'Pixel', added: '2026-11-07T10:00:00Z' }]);
  });

  it('numbers passkeys that Kratos calls "unnamed"', () => {
    const unnamed = (id: string) => ({
      attributes: { name: 'passkey_remove', value: id },
      meta: { label: { context: { display_name: 'unnamed' } } },
    });
    const flow: Flow = { id: 'f', ui: { nodes: [unnamed('a'), unnamed('b')] } };
    expect(passkeysOf(flow).map((p) => p.name)).toEqual(['Passkey 1', 'Passkey 2']);
  });
});
