import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '@smarthome/api-client';

import { useMyTrustedDevices, useRegisterBrowserPasskey, useRevokeMyTrustedDevice } from '../api';
import { hasPlatformAuthenticator } from '../auth/approvalPasskey';
import { PasskeyCancelled } from '../auth/webauthn';
import { Errors } from '../components/AuthLayout';
import { useToast } from '../components/Toasts';

function formatDate(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Words for the backend's problem codes that matter here; everything else as the backend says it. */
function explain(error: unknown): string[] {
  if (error instanceof ApiError && error.status === 403 && (error.problem as { reason?: string } | undefined)?.reason === 'fresh_login_required') {
    return ['Aus Sicherheitsgründen geht das nur direkt nach der Anmeldung. Bitte melde dich ab, wieder an und versuche es sofort noch einmal.'];
  }
  return [error instanceof Error ? error.message : 'Das hat nicht geklappt.'];
}

/**
 * Door approvals in this browser: a passkey of this device (fingerprint, face or PIN, every time) lets you approve your
 * own request without a second person. Needs a login at most 15 minutes old, like registering a phone.
 */
export function ApprovalPasskeySettings() {
  const toast = useToast();
  const devices = useMyTrustedDevices();
  const register = useRegisterBrowserPasskey();
  const revoke = useRevokeMyTrustedDevice();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [name, setName] = useState('Dieser Browser');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    void hasPlatformAuthenticator().then(setAvailable);
  }, []);

  if (available === null) {
    return null;
  }
  const mine = (devices.data ?? []).filter((d) => d.kind === 'webauthn' && d.active);

  const add = () => {
    setErrors([]);
    register.mutate(name.trim(), {
      onSuccess: () => toast('success', 'Dieser Browser kann jetzt Freigaben bestätigen.'),
      onError: (error) => {
        if (!(error instanceof PasskeyCancelled)) {
          setErrors(explain(error));
        }
      },
    });
  };

  return (
    <section className="passkeys" aria-labelledby="approval-title">
      <h2 id="approval-title">Freigaben in diesem Browser</h2>
      <p className="hint">
        Mit einem Passkey dieses Geräts gibst du deine eigene Anfrage (z. B. die Haustür) selbst frei: pro Freigabe einmal Fingerabdruck,
        Gesicht oder Geräte-PIN. Ohne Passkey gibt ein anderer Mensch frei, oder du nutzt das Handy.
      </p>
      {mine.length > 0 && (
        <ul className="passkey-list">
          {mine.map((d) => (
            <li key={d.id}>
              <span>
                <strong>{d.name}</strong>
                {d.createdAt && <span className="muted"> · hinzugefügt am {formatDate(d.createdAt)}</span>}
              </span>
              <button
                type="button"
                className="link"
                disabled={revoke.isPending || d.id === undefined}
                onClick={() => d.id !== undefined && revoke.mutate(d.id, { onSuccess: () => toast('success', 'Passkey entfernt.') })}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
      {available ? (
        <>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          </label>
          <Errors texts={errors} />
          <button type="button" className="ghost" onClick={add} disabled={register.isPending || name.trim() === ''}>
            Diesen Browser für Freigaben einrichten
          </button>
          <p className="hint">
            Nach dem Anmelden hast du 15 Minuten dafür. <Link to="/">Zurück zur Startseite</Link>
          </p>
        </>
      ) : (
        <p className="hint">Dieses Gerät hat keine eingebaute Passkey-Sicherung (Fingerabdruck, Gesicht oder PIN). Nutze das Handy für Freigaben.</p>
      )}
    </section>
  );
}
