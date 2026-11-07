import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

import { ApiError, type Confirmation } from '@smarthome/api-client';

import { useApproveWithPasskey, useDecide, useMyTrustedDevices, usePendingConfirmations } from '../api';
import { PasskeyCancelled } from '../auth/webauthn';
import { Icon } from './Icon';
import { useToast } from './Toasts';

/**
 * Open requests: one's own ("waiting for approval") and those one may decide, as banners on top. A request of
 * someone else that one may decide and that comes in after the page loaded (live) also opens a dialog, so it is not
 * missed; "Später" leaves it in the banner. Requests that were open already when the page loaded only show as banner.
 * One's own request is approved with a passkey of this browser (one fingerprint/face/PIN gesture per approval) or in the
 * phone app; otherwise another person approves.
 */
export function Confirmations() {
  const { data } = usePendingConfirmations();
  const decide = useDecide();
  const approveWithPasskey = useApproveWithPasskey();
  const trusted = useMyTrustedDevices();
  const passkey = trusted.data?.find((d) => d.kind === 'webauthn' && d.active);
  const toast = useToast();
  const now = useNow();
  // Requests whose dialog was closed (or decided) in this visit; they stay in the banner only
  const [dismissed, setDismissed] = useState<ReadonlySet<number>>(() => new Set());
  // Requests that were open at the first load; null until the list is there
  const [initial, setInitial] = useState<ReadonlySet<number> | null>(null);
  if (data && initial === null) {
    // Adjusting state while rendering, once (React's pattern for values derived from the first data)
    setInitial(new Set(data.flatMap((c) => (c.id === undefined ? [] : [c.id]))));
  }
  const pending = (data ?? []).filter((c) => !c.expiresAt || new Date(c.expiresAt).getTime() > now);
  if (pending.length === 0) {
    return null;
  }

  const dismiss = (id: number) => setDismissed((all) => new Set(all).add(id));
  const decideOn = (c: Confirmation, approve: boolean) => {
    if (c.id === undefined) {
      return;
    }
    dismiss(c.id);
    decide.mutate(
      { id: c.id, approve },
      {
        onSuccess: approve ? () => toast('success', 'Freigegeben') : undefined,
        onError: (e) => toast('error', message(e)),
      },
    );
  };
  const signOff = (c: Confirmation) => {
    if (c.id === undefined || !passkey) {
      return;
    }
    approveWithPasskey.mutate(
      { id: c.id, device: passkey },
      {
        onSuccess: () => toast('success', 'Freigegeben'),
        onError: (e) => {
          if (!(e instanceof PasskeyCancelled)) {
            toast('error', message(e));
          }
        },
      },
    );
  };
  const asking = pending.find(
    (c) => c.canDecide && !c.mine && c.id !== undefined && initial !== null && !initial.has(c.id) && !dismissed.has(c.id),
  );

  return (
    <section className="confirmations" aria-label="Offene Freigaben">
      {pending.map((c) => (
        <div key={c.id} className="banner banner-warn confirmation">
          <span className="banner-icon" aria-hidden="true">
            <Icon name="approval" />
          </span>
          <div className="banner-text">
            <strong>{c.deviceName}</strong>: {actionText(c)}
            <p className="device-meta">
              {c.mine ? 'Deine Anfrage wartet auf Freigabe' : `Anfrage von ${c.userName}`} · noch {remaining(c.expiresAt, now)}
            </p>
          </div>
          {c.mine && c.canApproveWithPhone && c.id !== undefined && (
            <div className="row">
              {passkey ? (
                <button type="button" className="primary" disabled={approveWithPasskey.isPending} onClick={() => signOff(c)}>
                  {approveWithPasskey.isPending ? 'Warte auf Bestätigung …' : 'Mit Passkey freigeben'}
                </button>
              ) : (
                <span className="device-meta">Gib mit dem Handy frei, oder richte unter „Konto“ einen Passkey für diesen Browser ein.</span>
              )}
            </div>
          )}
          {c.canDecide && c.id !== undefined && (
            <div className="row">
              <button type="button" disabled={decide.isPending} onClick={() => decideOn(c, false)}>
                Ablehnen
              </button>
              <button type="button" className="primary" disabled={decide.isPending} onClick={() => decideOn(c, true)}>
                Freigeben
              </button>
            </div>
          )}
        </div>
      ))}

      <Dialog.Root
        open={asking !== undefined}
        onOpenChange={(open) => {
          if (!open && asking?.id !== undefined) {
            dismiss(asking.id);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog">
            {asking && (
              <>
                <span className="dialog-icon" aria-hidden="true">
                  <Icon name="approval" size={24} />
                </span>
                <Dialog.Title>Freigabe angefragt</Dialog.Title>
                <Dialog.Description>
                  {asking.userName} möchte <strong>{asking.deviceName}</strong> {asking.action === 'unlock' ? 'öffnen' : 'schalten'}.
                  <span className="device-meta"> Noch {remaining(asking.expiresAt, now)}.</span>
                </Dialog.Description>
                <div className="dialog-actions">
                  <Dialog.Close asChild>
                    <button type="button" className="ghost">
                      Später
                    </button>
                  </Dialog.Close>
                  <button type="button" disabled={decide.isPending} onClick={() => decideOn(asking, false)}>
                    Ablehnen
                  </button>
                  <button type="button" className="primary" disabled={decide.isPending} onClick={() => decideOn(asking, true)}>
                    Freigeben
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function actionText(c: Confirmation): string {
  return c.action === 'unlock' ? 'Öffnen' : 'Schalten';
}

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Das hat nicht geklappt';
}

function remaining(expiresAt: string | undefined, now: number): string {
  if (!expiresAt) {
    return '';
  }
  const seconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
