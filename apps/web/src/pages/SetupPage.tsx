import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { KratosError, getFlow, localPath, messages, submitFlow, type Flow } from '../auth/kratos';
import { errorTexts } from '../auth/texts';
import { AuthLayout, Errors } from '../components/AuthLayout';

/**
 * "Konto einrichten": the link from the admin (Kratos recovery flow) leads here. The person enters the code, then
 * Kratos hands over to the settings flow, where they choose a password (AccountPage).
 */
export function SetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const flowId = params.get('flow');
  const [flow, setFlow] = useState<Flow | null>(null);
  const [code, setCode] = useState(params.get('code') ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!flowId) {
      return;
    }
    getFlow('recovery', flowId)
      .then(setFlow)
      .catch((error: unknown) =>
        setErrors([
          error instanceof KratosError && error.status === 410
            ? 'Der Einrichtungslink ist abgelaufen. Bitte beim Admin einen neuen anfordern.'
            : 'Der Einrichtungslink ist ungültig. Bitte beim Admin einen neuen anfordern.',
        ]),
      );
  }, [flowId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!flow) {
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await submitFlow('recovery', flow, { method: 'code', code: code.trim() });
      if (result.kind === 'redirect') {
        navigate(localPath(result.to), { replace: true, state: { setup: true } });
      } else if (result.kind === 'invalid') {
        setFlow(result.flow);
        setErrors(errorTexts(messages(result.flow)));
      } else {
        navigate('/account', { replace: true, state: { setup: true } });
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Einrichtung fehlgeschlagen']);
    } finally {
      setBusy(false);
    }
  };

  if (!flowId) {
    return (
      <AuthLayout title="Konto einrichten">
        <p>Öffne den Einrichtungslink, den du vom Admin bekommen hast, und gib dort den sechsstelligen Code ein.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Konto einrichten">
      <p>Gib den Code ein, den du vom Admin bekommen hast. Danach wählst du dein Passwort.</p>
      <form onSubmit={submit} className="form">
        <label>
          Einrichtungscode
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            required
            autoFocus
          />
        </label>
        <Errors texts={errors} />
        <button type="submit" className="primary" disabled={busy || !flow}>
          Weiter
        </button>
      </form>
    </AuthLayout>
  );
}
