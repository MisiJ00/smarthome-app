import * as Dialog from '@radix-ui/react-dialog';

import type { CommandIntent } from '@smarthome/core';

import { Icon } from '../components/Icon';

export type ConfirmState =
  | { phase: 'ask' | 'sending'; deviceName: string; intent: CommandIntent }
  /** Request created: the person confirms it in the app with the fingerprint. */
  | { phase: 'inApp'; deviceName: string; intent: CommandIntent; confirmationId?: number; expiresAt?: string };

/**
 * "Wirklich öffnen?" before an action that needs an approval. The person confirms it themselves; in the browser not
 * yet with the fingerprint, so after "Öffnen" the dialog says to confirm in the Smart Home app (which shows the open
 * request as a dialog with the fingerprint prompt at once).
 */
export function ConfirmDialog({
  state,
  onConfirm,
  onWithdraw,
  onClose,
}: {
  state: ConfirmState | null;
  onConfirm: () => void;
  /** Takes back the created request (the person changed their mind). */
  onWithdraw: () => void;
  onClose: () => void;
}) {
  const sending = state?.phase === 'sending';
  return (
    <Dialog.Root open={state !== null} onOpenChange={(open) => !open && !sending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog confirm-dialog">
          {state && (
            <>
              <span className="dialog-icon">
                <Icon name={state.phase === 'inApp' ? 'phone' : state.intent.action === 'unlock' ? 'unlock' : 'approval'} size={24} />
              </span>
              <p className="confirm-device">
                {state.intent.verb} · <strong>{state.deviceName}</strong>
              </p>
              <Dialog.Title>{state.phase === 'inApp' ? 'Jetzt in der App bestätigen' : state.intent.question}</Dialog.Title>
              <Dialog.Description>
                {state.phase === 'inApp'
                  ? 'Bestätige jetzt in der Smart-Home-App mit Fingerabdruck. Die App zeigt die Anfrage beim Öffnen sofort an.'
                  : 'Du bestätigst das gleich selbst mit deinem Fingerabdruck in der Smart-Home-App. Niemand sonst muss zustimmen.'}
              </Dialog.Description>
              <div className="dialog-actions">
                {state.phase === 'inApp' ? (
                  <>
                    {state.confirmationId !== undefined && (
                      <button type="button" className="ghost" onClick={onWithdraw}>
                        Anfrage zurückziehen
                      </button>
                    )}
                    <button type="button" className="primary" onClick={onClose}>
                      Verstanden
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ghost" disabled={sending} onClick={onClose}>
                      Abbrechen
                    </button>
                    <button type="button" className="primary" disabled={sending} onClick={onConfirm}>
                      <Icon name="approval" size={16} />
                      {state.intent.verb}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
