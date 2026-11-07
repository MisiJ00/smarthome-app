import { useCallback, useEffect, useState } from 'react';

import { KratosError, createFlow, messages, submitFlow, type Flow, type UiNode } from '../auth/kratos';
import { errorTexts } from '../auth/texts';
import { PasskeyCancelled, createPasskey, passkeysSupported } from '../auth/webauthn';
import { Errors } from '../components/AuthLayout';
import { useToast } from '../components/Toasts';

interface Passkey {
  id: string;
  name: string;
  added: string | undefined;
}

/** The passkeys Kratos lists in the settings flow (one "remove" button each; the label carries name and date). */
export function passkeysOf(flow: Flow): Passkey[] {
  return flow.ui.nodes
    .filter((n: UiNode) => n.attributes.name === 'passkey_remove')
    .map((n, index) => {
      const context = n.meta?.label?.context ?? {};
      const added = typeof context['added_at'] === 'string' ? context['added_at'] : undefined;
      // Kratos names every passkey "unnamed"; number them instead
      const given = context['display_name'];
      const name = typeof given === 'string' && given !== '' && given !== 'unnamed' ? given : `Passkey ${index + 1}`;
      return { id: String(n.attributes.value ?? ''), name, added };
    });
}

function formatDate(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Passkeys of the signed-in account: add one on this device, remove old ones. */
export function PasskeySettings() {
  const toast = useToast();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      createFlow('settings')
        .then(setFlow)
        .catch(() => setErrors(['Die Passkeys konnten nicht geladen werden.'])),
    [],
  );

  useEffect(() => {
    // Not `void load()`: the lint rule wants state set in a callback, not synchronously in the effect
    createFlow('settings')
      .then(setFlow)
      .catch(() => setErrors(['Die Passkeys konnten nicht geladen werden.']));
  }, []);

  const run = async (values: (flow: Flow) => Promise<Record<string, unknown>>, done: string) => {
    if (!flow) {
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await submitFlow('settings', flow, await values(flow));
      if (result.kind === 'invalid') {
        setFlow(result.flow);
        setErrors(errorTexts(messages(result.flow)));
        return;
      }
      toast('success', done);
      await load();
    } catch (error) {
      if (error instanceof PasskeyCancelled) {
        return;
      }
      if (error instanceof KratosError && error.id === 'session_refresh_required') {
        setErrors(['Aus Sicherheitsgründen bitte erst neu anmelden, dann noch einmal versuchen.']);
      } else {
        setErrors([error instanceof Error ? error.message : 'Das hat nicht geklappt.']);
      }
    } finally {
      setBusy(false);
    }
  };

  const add = () => run(async (f) => ({ method: 'passkey', passkey_settings_register: await createPasskey(f) }), 'Passkey hinzugefügt.');
  const remove = (id: string) => run(() => Promise.resolve({ method: 'passkey', passkey_remove: id }), 'Passkey entfernt.');

  if (!passkeysSupported()) {
    return null;
  }
  const passkeys = flow ? passkeysOf(flow) : [];
  return (
    <section className="passkeys" aria-labelledby="passkeys-title">
      <h2 id="passkeys-title">Passkeys</h2>
      <p className="hint">
        Melde dich mit Fingerabdruck, Gesichtserkennung oder Geräte-PIN an, ohne Passwort. Der Passkey bleibt auf diesem Gerät oder in deinem
        Passwort-Manager.
      </p>
      {passkeys.length > 0 && (
        <ul className="passkey-list">
          {passkeys.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.name}</strong>
                {p.added && <span className="muted"> · hinzugefügt am {formatDate(p.added)}</span>}
              </span>
              <button type="button" className="link" onClick={() => void remove(p.id)} disabled={busy}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
      <Errors texts={errors} />
      <button type="button" className="ghost" onClick={() => void add()} disabled={busy || !flow}>
        Passkey hinzufügen
      </button>
    </section>
  );
}
