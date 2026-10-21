import { useEffect, useState } from 'react';

import { ApiError } from '@smarthome/api-client';

import { useDecide, usePendingConfirmations } from '../api';
import { useToast } from './Toasts';

/**
 * Open requests: one's own ("waiting for approval") and those one may decide. Approving with Face ID needs the
 * phone app; here another person approves.
 */
export function Confirmations() {
  const { data } = usePendingConfirmations();
  const decide = useDecide();
  const toast = useToast();
  const now = useNow();
  const pending = (data ?? []).filter((c) => !c.expiresAt || new Date(c.expiresAt).getTime() > now);
  if (pending.length === 0) {
    return null;
  }
  return (
    <section className="confirmations" aria-label="Offene Freigaben">
      {pending.map((c) => (
        <div key={c.id} className="confirmation">
          <div>
            <strong>{c.deviceName}</strong>: {c.action === 'unlock' ? 'Öffnen' : 'Schalten'}
            <p className="device-meta">
              {c.mine ? 'Deine Anfrage wartet auf Freigabe' : `Anfrage von ${c.userName}`} · noch {remaining(c.expiresAt, now)}
            </p>
          </div>
          {c.canDecide && c.id !== undefined && (
            <div className="row">
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: c.id!, approve: false }, { onError: (e) => toast('error', message(e)) })}
              >
                Ablehnen
              </button>
              <button
                type="button"
                className="primary"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate(
                    { id: c.id!, approve: true },
                    { onSuccess: () => toast('success', 'Freigegeben'), onError: (e) => toast('error', message(e)) },
                  )
                }
              >
                Freigeben
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
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
