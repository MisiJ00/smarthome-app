import { ApiError, type Device } from '@smarthome/api-client';
import { commandIntent, lockedReason } from '@smarthome/core';

import { useCommand } from '../../lib/api';
import { useToast } from '../ui';
import { useConfirmAction } from './ConfirmAction';
import { rejectFeedback } from './haptics';

/**
 * Sends commands to one device (cards and tiles): a locked action gives a short notice instead of a refused request;
 * one that needs an approval goes through the confirm dialog ("Wirklich öffnen?", fingerprint); everything else is
 * sent at once, with the backend's message on errors.
 */
export function useDeviceSend(device: Device) {
  const command = useCommand();
  const toast = useToast();
  const confirm = useConfirmAction();

  const send = (body: Record<string, unknown>) => {
    if (device.id === undefined) {
      return;
    }
    const intent = commandIntent(device, body);
    if (intent.locked) {
      rejectFeedback();
      toast('info', intent.locked);
      return;
    }
    if (intent.requiresConfirmation && confirm) {
      confirm.ask(device, body);
      return;
    }
    command.mutate(
      { deviceId: device.id, command: body },
      {
        onSuccess: (result) => {
          // Only when the device data did not announce the approval (rights changed meanwhile): the confirm
          // dialog picks up this open own request and asks for the fingerprint, the toast is just the notice.
          if (result.status === 'confirmation_required') {
            toast('info', `${device.name}: wartet auf Freigabe`);
          }
        },
        onError: (error) => toast('error', error instanceof ApiError ? error.message : 'Befehl fehlgeschlagen'),
      },
    );
  };

  return {
    send,
    isPending: command.isPending,
    /** Why this command is locked ("Ausschalten ist gesperrt"), for disabled controls. */
    lockedFor: (body: Record<string, unknown>) => lockedReason(device, body),
  };
}
