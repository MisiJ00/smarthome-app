import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import { KratosError, createFlow, getFlow, messages, submitFlow, type Flow } from '../auth/kratos';
import { errorTexts } from '../auth/texts';
import { AuthLayout, Errors } from '../components/AuthLayout';
import { useToast } from '../components/Toasts';

/** Choose a password (after the setup code) or change it (Kratos settings flow). */
export function AccountPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useAuth();
  const isSetup = Boolean((location.state as { setup?: boolean } | null)?.setup) || params.has('flow');
  const [flow, setFlow] = useState<Flow | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = params.get('flow');
    (id ? getFlow('settings', id) : createFlow('settings'))
      .then(setFlow)
      .catch((error: unknown) => {
        if (error instanceof KratosError && error.status === 401) {
          navigate('/login', { replace: true });
        } else {
          setErrors(['Das geht gerade nicht. Bitte neu anmelden und noch einmal versuchen.']);
        }
      });
  }, [params, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!flow) {
      return;
    }
    if (password !== repeat) {
      setErrors(['Die beiden Passwörter sind nicht gleich.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await submitFlow('settings', flow, { method: 'password', password });
      if (result.kind === 'invalid') {
        setFlow(result.flow);
        setErrors(errorTexts(messages(result.flow)));
        return;
      }
      await refresh();
      toast('success', isSetup ? 'Dein Konto ist eingerichtet.' : 'Passwort geändert.');
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof KratosError && error.id === 'session_refresh_required') {
        setErrors(['Aus Sicherheitsgründen bitte erst neu anmelden, dann das Passwort ändern.']);
      } else {
        setErrors([error instanceof Error ? error.message : 'Speichern fehlgeschlagen']);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={isSetup ? 'Passwort wählen' : 'Passwort ändern'}>
      <form onSubmit={submit} className="form">
        <label>
          Neues Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={10}
            required
            autoFocus
          />
        </label>
        <label>
          Noch einmal
          <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
        </label>
        <p className="hint">Mindestens 10 Zeichen. Ein langer Satz ist leichter zu merken als kryptische Zeichen.</p>
        <Errors texts={errors} />
        <button type="submit" className="primary" disabled={busy || !flow}>
          Speichern
        </button>
      </form>
      {!isSetup && (
        <p className="hint">
          <Link to="/">Zurück</Link>
        </p>
      )}
    </AuthLayout>
  );
}
