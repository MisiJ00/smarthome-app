// Passkeys (WebAuthn) for Ory Kratos's browser flows. Kratos normally ships a script (webauthn.js) that does this
// in the page; here the few steps live in the app itself, so no foreign script is loaded and they can be tested.
//
// Kratos hands over the options as JSON with base64url fields and wants the browser's answer back as one JSON string.

import type { Flow } from './kratos';

export function base64urlToBytes(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bytesToBase64url(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) {
    return '';
  }
  let binary = '';
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface WireDescriptor {
  id: string;
  type: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
}

interface WireRequestOptions {
  publicKey: Omit<PublicKeyCredentialRequestOptions, 'challenge' | 'allowCredentials'> & {
    challenge: string;
    allowCredentials?: WireDescriptor[];
  };
}

interface WireCreationOptions {
  publicKey: Omit<PublicKeyCredentialCreationOptions, 'challenge' | 'user' | 'excludeCredentials'> & {
    challenge: string;
    user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
    excludeCredentials?: WireDescriptor[];
  };
}

const descriptors = (list: WireDescriptor[] | undefined): PublicKeyCredentialDescriptor[] | undefined =>
  list?.map((d) => ({ ...d, id: base64urlToBytes(d.id) }));

/** Browser options for signing in, from Kratos's challenge. */
export function requestOptions(wire: WireRequestOptions): PublicKeyCredentialRequestOptions {
  const { challenge, allowCredentials, ...rest } = wire.publicKey;
  const allowed = descriptors(allowCredentials);
  return { ...rest, challenge: base64urlToBytes(challenge), ...(allowed ? { allowCredentials: allowed } : {}) };
}

/** Browser options for creating a passkey, from Kratos's data. */
export function creationOptions(wire: WireCreationOptions): PublicKeyCredentialCreationOptions {
  const { challenge, user, excludeCredentials, ...rest } = wire.publicKey;
  const excluded = descriptors(excludeCredentials);
  return {
    ...rest,
    challenge: base64urlToBytes(challenge),
    user: { ...user, id: base64urlToBytes(user.id) },
    ...(excluded ? { excludeCredentials: excluded } : {}),
  };
}

/** The browser's answer to a sign-in, as the JSON string Kratos expects in passkey_login. */
export function assertionJson(credential: PublicKeyCredential): string {
  const response = credential.response as AuthenticatorAssertionResponse;
  return JSON.stringify({
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bytesToBase64url(response.authenticatorData),
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      signature: bytesToBase64url(response.signature),
      userHandle: bytesToBase64url(response.userHandle),
    },
  });
}

/** The browser's answer to creating a passkey, as the JSON string Kratos expects in passkey_settings_register. */
export function attestationJson(credential: PublicKeyCredential): string {
  const response = credential.response as AuthenticatorAttestationResponse;
  return JSON.stringify({
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bytesToBase64url(response.attestationObject),
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
    },
  });
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && Boolean(navigator.credentials);
}

/** Why a passkey step failed, in words for the user. Cancelling is not an error worth shouting about. */
export class PasskeyCancelled extends Error {}

export function passkeyError(error: unknown): never {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
    throw new PasskeyCancelled('Abgebrochen');
  }
  if (error instanceof DOMException && error.name === 'InvalidStateError') {
    throw new Error('Für dieses Gerät gibt es schon einen Passkey.');
  }
  throw error;
}

function nodeValue(flow: Flow, name: string): string {
  const node = flow.ui.nodes.find((n) => n.attributes.name === name);
  const value = node?.attributes.value;
  if (typeof value !== 'string' || value === '') {
    throw new Error('Passkeys sind auf diesem Server nicht eingerichtet.');
  }
  return value;
}

/** Asks the browser to sign in with a passkey; returns the JSON for {@code passkey_login}. */
export async function getPasskeyAssertion(loginFlow: Flow): Promise<string> {
  const options = requestOptions(JSON.parse(nodeValue(loginFlow, 'passkey_challenge')) as WireRequestOptions);
  try {
    const credential = await navigator.credentials.get({ publicKey: options });
    return assertionJson(credential as PublicKeyCredential);
  } catch (error) {
    return passkeyError(error);
  }
}

/** Asks the browser to create a passkey; returns the JSON for {@code passkey_settings_register}. */
export async function createPasskey(settingsFlow: Flow): Promise<string> {
  const options = creationOptions(JSON.parse(nodeValue(settingsFlow, 'passkey_create_data')) as WireCreationOptions);
  try {
    const credential = await navigator.credentials.create({ publicKey: options });
    return attestationJson(credential as PublicKeyCredential);
  } catch (error) {
    return passkeyError(error);
  }
}
