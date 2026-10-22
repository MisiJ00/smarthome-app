import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ApiError, unwrap, type Confirmation } from '@smarthome/api-client';

import DeviceKey from '../../modules/device-key';
import { keys, useApi, useMe } from './api';

/**
 * This phone as an approval device: a fingerprint-bound key in the Android Keystore whose public key is registered
 * at the backend (/api/me/trusted-devices). Per user, so a second account on the same phone gets its own key.
 */
const alias = (userId: number) => `smarthome-approval-${userId}`;
const storeKey = (userId: number) => `smarthome.phone.${userId}`;

export type PhoneState =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'none' }
  | { kind: 'registered'; trustedDeviceId: number; name: string };

/** Whether this phone can sign approvals for the signed-in user, checked against the backend's list. */
export function usePhone() {
  const api = useApi();
  const me = useMe();
  const userId = me.data?.id;
  return useQuery({
    queryKey: [...keys.phones, userId],
    enabled: userId !== undefined,
    queryFn: async (): Promise<PhoneState> => {
      if (Platform.OS !== 'android') {
        return { kind: 'unsupported', reason: 'Freigabe per Fingerabdruck gibt es nur in der Android-App.' };
      }
      if (!(await DeviceKey.isAvailable())) {
        return { kind: 'unsupported', reason: 'Auf diesem Handy ist kein Fingerabdruck eingerichtet.' };
      }
      const stored = await SecureStore.getItemAsync(storeKey(userId!));
      if (!stored || !(await DeviceKey.hasKey(alias(userId!)))) {
        return { kind: 'none' };
      }
      const id = Number(stored);
      const phones = unwrap(await api.GET('/api/me/trusted-devices'));
      const phone = phones.find((p) => p.id === id && p.active);
      if (!phone) {
        // revoked (by the user elsewhere or an admin): the key is useless now
        await forget(userId!);
        return { kind: 'none' };
      }
      return { kind: 'registered', trustedDeviceId: id, name: phone.name ?? '' };
    },
  });
}

async function forget(userId: number) {
  await SecureStore.deleteItemAsync(storeKey(userId));
  await DeviceKey.deleteKey(alias(userId));
}

/** Creates the key and registers it. Needs a login of at most 15 minutes ago (otherwise ApiError with reason fresh_login_required). */
export function useRegisterPhone() {
  const api = useApi();
  const me = useMe();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const userId = me.data!.id!;
      await DeviceKey.deleteKey(alias(userId));
      const publicKey = await DeviceKey.createKey(alias(userId));
      try {
        const phone = unwrap(await api.POST('/api/me/trusted-devices', { body: { name, publicKey } }));
        await SecureStore.setItemAsync(storeKey(userId), String(phone.id));
      } catch (e) {
        await DeviceKey.deleteKey(alias(userId));
        throw e;
      }
    },
    onSettled: () => queries.invalidateQueries({ queryKey: keys.phones }),
  });
}

export function useRemovePhone() {
  const api = useApi();
  const me = useMe();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (trustedDeviceId: number) => {
      unwrap(await api.DELETE('/api/me/trusted-devices/{id}', { params: { path: { id: trustedDeviceId } } }));
      await forget(me.data!.id!);
    },
    onSettled: () => queries.invalidateQueries({ queryKey: keys.phones }),
  });
}

/** Approves with the fingerprint: fetches a challenge, signs its payload on the phone, sends the signature. */
export function useApproveWithPhone() {
  const api = useApi();
  const me = useMe();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async ({ confirmation, trustedDeviceId }: { confirmation: Confirmation; trustedDeviceId: number }) => {
      const id = confirmation.id!;
      const challenge = unwrap(await api.POST('/api/confirmations/{id}/challenge', { params: { path: { id } } }));
      const signature = await DeviceKey.sign(
        alias(me.data!.id!),
        challenge.payload!,
        'Freigeben',
        `${confirmation.deviceName}: ${confirmation.action === 'unlock' ? 'öffnen' : 'schalten'}`,
      );
      return unwrap(
        await api.POST('/api/confirmations/{id}/approve', {
          params: { path: { id } },
          body: { trustedDeviceId, nonce: challenge.nonce, signature },
        }),
      );
    },
    onSettled: () => queries.invalidateQueries({ queryKey: keys.pendingConfirmations }),
  });
}

/** A readable message for errors from the calls above, including the native module's codes. */
export function phoneError(e: unknown): string {
  if (e instanceof ApiError) {
    return e.problem?.reason === 'fresh_login_required'
      ? 'Zum Einrichten musst du dich gerade erst angemeldet haben. Melde dich ab und wieder an, dann versuch es nochmal.'
      : e.message;
  }
  const code = (e as { code?: string } | null)?.code;
  if (code === 'CANCELLED') {
    return 'Abgebrochen';
  }
  return e instanceof Error ? e.message : 'Das hat nicht geklappt';
}

export function defaultPhoneName(): string {
  const model = Platform.OS === 'android' ? (Platform.constants as { Model?: string }).Model : undefined;
  return model || 'Handy';
}
