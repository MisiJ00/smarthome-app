// Approving with a browser passkey: a WebAuthn credential on this device (platform authenticator, user verification
// required) is registered with the backend as a trusted device, and every approval of one's own door request is one
// gesture (fingerprint, face or PIN) that signs the hash of the approval text. See homeserver-infra/docs/smarthome-backend.md.

import { base64urlToBytes, bytesToBase64url, passkeyError } from './webauthn';

/** What POST /api/me/trusted-devices/webauthn/challenge returns. */
export interface RegistrationOptions {
  challenge?: string;
  rpId?: string;
  rpName?: string;
  userHandle?: string;
  userName?: string;
  excludeCredentialIds?: string[];
}

export function approvalPasskeysSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && Boolean(navigator.credentials) && Boolean(crypto?.subtle);
}

/** Whether this browser has an authenticator built in (Touch ID, Windows Hello, Android screen lock). */
export async function hasPlatformAuthenticator(): Promise<boolean> {
  try {
    return approvalPasskeysSupported() && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Browser options for creating the credential: platform, user verification required, ES256 only, no attestation. */
export function approvalCreationOptions(options: RegistrationOptions): PublicKeyCredentialCreationOptions {
  if (!options.challenge || !options.rpId || !options.userHandle) {
    throw new Error('Die Antwort des Servers ist unvollständig.');
  }
  const userName = options.userName ?? 'Freigabe';
  return {
    rp: { id: options.rpId, name: options.rpName ?? 'Smart Home' },
    user: { id: base64urlToBytes(options.userHandle), name: userName, displayName: userName },
    challenge: base64urlToBytes(options.challenge),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    excludeCredentials: (options.excludeCredentialIds ?? []).map((id) => ({ type: 'public-key', id: base64urlToBytes(id) })),
    attestation: 'none',
    timeout: 60_000,
  };
}

/** Creates the credential; returns what POST /api/me/trusted-devices/webauthn takes. */
export async function createApprovalCredential(
  options: RegistrationOptions,
): Promise<{ clientDataJson: string; attestationObject: string }> {
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({ publicKey: approvalCreationOptions(options) })) as PublicKeyCredential | null;
  } catch (error) {
    return passkeyError(error);
  }
  if (!credential) {
    throw new Error('Es wurde kein Passkey erstellt.');
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    clientDataJson: bytesToBase64url(response.clientDataJSON),
    attestationObject: bytesToBase64url(response.attestationObject),
  };
}

/** Browser options for signing the approval text: its SHA-256 is the challenge, one gesture is required. */
export function approvalRequestOptions(challenge: ArrayBuffer, credentialId: string): PublicKeyCredentialRequestOptions {
  return {
    challenge,
    allowCredentials: [{ type: 'public-key', id: base64urlToBytes(credentialId), transports: ['internal', 'hybrid'] }],
    userVerification: 'required',
    timeout: 60_000,
  };
}

/** Signs the approval text with the passkey; returns the body fields for POST /api/confirmations/{id}/approve. */
export async function signApproval(
  payload: string,
  credentialId: string,
): Promise<{ signature: string; authenticatorData: string; clientDataJson: string }> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({ publicKey: approvalRequestOptions(digest, credentialId) })) as PublicKeyCredential | null;
  } catch (error) {
    return passkeyError(error);
  }
  if (!credential) {
    throw new Error('Es wurde keine Unterschrift erstellt.');
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    signature: bytesToBase64url(response.signature),
    authenticatorData: bytesToBase64url(response.authenticatorData),
    clientDataJson: bytesToBase64url(response.clientDataJSON),
  };
}
