import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import { KratosError, createFlow, messages, submitFlow, type Flow } from '../auth/kratos';
import { errorTexts } from '../auth/texts';
import { AuthLayout, Errors } from '../components/AuthLayout';

/** Login with email or username and password; with TOTP set up, the second factor follows. */
export function LoginPage() {
  const { state, refresh } = useAuth();
  if (state.status === 'signedIn') {
    return <Navigate to="/" replace />;
  }
  if (state.status === 'needsSecondFactor') {
    return <SecondFactor onDone={refresh} />;
  }
  return <Password onDone={refresh} />;
}

function Password({ onDone }: { onDone: () => Promise<void> }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const flow = await startFlow({});
      const result = await submitFlow('login', flow, { method: 'password', identifier: identifier.trim(), password });
      if (result.kind === 'invalid') {
        setErrors(errorTexts(messages(result.flow)));
      } else {
        await onDone();
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Anmelden">
      <form onSubmit={submit} className="form">
        <label>
          E-Mail oder Benutzername
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Passwort
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <Errors texts={errors} />
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Melde an …' : 'Anmelden'}
        </button>
      </form>
      <p className="hint">Neues Konto? Öffne den Einrichtungslink, den du vom Admin bekommen hast.</p>
    </AuthLayout>
  );
}

function SecondFactor({ onDone }: { onDone: () => Promise<void> }) {
  const { logout } = useAuth();
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const flow = await startFlow({ aal: 'aal2' });
      const values = useBackupCode
        ? { method: 'lookup_secret', lookup_secret: code.trim() }
        : { method: 'totp', totp_code: code.replace(/\s/g, '') };
      const result = await submitFlow('login', flow, values);
      if (result.kind === 'invalid') {
        setErrors(errorTexts(messages(result.flow)));
      } else {
        await onDone();
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Zweiter Faktor">
      <form onSubmit={submit} className="form">
        <label>
          {useBackupCode ? 'Backup-Code' : 'Code aus der Authenticator-App'}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={useBackupCode ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            required
            autoFocus
          />
        </label>
        <Errors texts={errors} />
        <button type="submit" className="primary" disabled={busy}>
          Bestätigen
        </button>
      </form>
      <div className="row">
        <button type="button" className="link" onClick={() => setUseBackupCode(!useBackupCode)}>
          {useBackupCode ? 'Code aus der App verwenden' : 'Backup-Code verwenden'}
        </button>
        <button type="button" className="link" onClick={() => void logout()}>
          Abbrechen
        </button>
      </div>
    </AuthLayout>
  );
}

/** A fresh login flow per attempt, so an expired flow never gets in the way. */
async function startFlow(params: Record<string, string>): Promise<Flow> {
  try {
    return await createFlow('login', params);
  } catch (error) {
    if (error instanceof KratosError && error.id === 'session_already_available') {
      // Signed in already (e.g. in another tab)
      window.location.assign('/');
    }
    throw error;
  }
}
