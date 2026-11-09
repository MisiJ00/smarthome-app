import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ApiError, unwrap } from '@smarthome/api-client';

import { useApi } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { safeRedirect, scopeText, sortScopes } from '../auth/oauthTexts';
import { AuthLayout, Errors } from '../components/AuthLayout';
import { Password, SecondFactor } from './LoginPage';

/*
 * Sign-in for other services (Immich, Nextcloud ...) with Hydra: the service sends the browser to Hydra, Hydra sends it
 * here with a challenge. The person signs in with Kratos as usual (password plus second factor or passkey); then the
 * backend answers Hydra with the person's own JWT. Hydra's admin API is never called from the browser.
 */

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Das hat nicht geklappt. Bitte im Dienst noch einmal auf "Anmelden" tippen.';
}

/** Goes to Hydra's next address; one that is not http(s) is refused. */
function go(url: string | undefined): boolean {
  const target = safeRedirect(url);
  if (!target) {
    return false;
  }
  window.location.assign(target);
  return true;
}

function Missing({ title }: { title: string }) {
  return (
    <AuthLayout title={title}>
      <Errors texts={['Dieser Link ist unvollständig. Bitte im Dienst noch einmal auf "Anmelden" tippen.']} />
      <p className="hint">
        <Link to="/">Zur Startseite</Link>
      </p>
    </AuthLayout>
  );
}

function Working({ title, text }: { title: string; text: string }) {
  return (
    <AuthLayout title={title}>
      <div className="page-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="muted">{text}</span>
      </div>
    </AuthLayout>
  );
}

/** The signed-in person is passed on to the service; the Kratos login page appears first when there is no session. */
function WithSession({ title, children }: { title: string; children: ReactNode }) {
  const { state, refresh } = useAuth();
  if (state.status === 'loading') {
    return <Working title={title} text="Lade …" />;
  }
  if (state.status === 'needsSecondFactor') {
    return <SecondFactor onDone={refresh} />;
  }
  if (state.status !== 'signedIn') {
    return <Password onDone={refresh} notice="Melde dich an, um dich bei einem anderen Dienst mit diesem Konto anzumelden." />;
  }
  return <>{children}</>;
}

/** /oauth/login?login_challenge=…: accepted by the backend as soon as a Kratos session exists. */
export function OAuthLoginPage() {
  const challenge = useSearchParams()[0].get('login_challenge');
  if (!challenge) {
    return <Missing title="Anmelden" />;
  }
  return (
    <WithSession title="Anmelden">
      <AcceptLogin challenge={challenge} />
    </WithSession>
  );
}

function AcceptLogin({ challenge }: { challenge: string }) {
  const api = useApi();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    api
      .POST('/api/oauth/login', { body: { challenge } })
      .then((result) => {
        if (!go(unwrap(result).redirectTo)) {
          setError('Der Dienst hat keine gültige Adresse zurückgegeben.');
        }
      })
      .catch((e: unknown) => setError(message(e)));
  }, [api, challenge]);
  if (error) {
    return (
      <AuthLayout title="Anmelden">
        <Errors texts={[error]} />
        <p className="hint">
          <Link to="/">Zur Startseite</Link>
        </p>
      </AuthLayout>
    );
  }
  return <Working title="Anmelden" text="Du wirst weitergeleitet …" />;
}

/** /oauth/consent?consent_challenge=…: asks what the service may see, unless it is one of our own trusted services. */
export function OAuthConsentPage() {
  const challenge = useSearchParams()[0].get('consent_challenge');
  if (!challenge) {
    return <Missing title="Zugriff erlauben" />;
  }
  return (
    <WithSession title="Zugriff erlauben">
      <Consent challenge={challenge} />
    </WithSession>
  );
}

type ConsentView = { redirectTo?: string | null; client?: { id?: string; name?: string; trusted?: boolean }; scopes?: string[] };

function Consent({ challenge }: { challenge: string }) {
  const api = useApi();
  const started = useRef(false);
  const [view, setView] = useState<ConsentView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    api
      .GET('/api/oauth/consent', { params: { query: { challenge } } })
      .then((result) => {
        const data = unwrap(result) as ConsentView;
        // Trusted services and requests that were answered before: no question, straight on
        if (data.redirectTo && !go(data.redirectTo)) {
          setError('Der Dienst hat keine gültige Adresse zurückgegeben.');
          return;
        }
        setView(data);
      })
      .catch((e: unknown) => setError(message(e)));
  }, [api, challenge]);

  const answer = async (accept: boolean) => {
    setBusy(true);
    setError('');
    try {
      const result = accept
        ? await api.POST('/api/oauth/consent/accept', { body: { challenge, scopes: view?.scopes ?? [] } })
        : await api.POST('/api/oauth/consent/reject', { body: { challenge } });
      if (!go(unwrap(result).redirectTo)) {
        setError('Der Dienst hat keine gültige Adresse zurückgegeben.');
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !view) {
    return (
      <AuthLayout title="Zugriff erlauben">
        <Errors texts={[error]} />
        <p className="hint">
          <Link to="/">Zur Startseite</Link>
        </p>
      </AuthLayout>
    );
  }
  if (!view || view.redirectTo) {
    return <Working title="Zugriff erlauben" text="Lade …" />;
  }
  const name = view.client?.name ?? 'Ein Dienst';
  return (
    <AuthLayout title="Zugriff erlauben">
      <p>
        <strong>{name}</strong> möchte sich mit deinem Konto anmelden und bekommt dafür:
      </p>
      <ul className="oauth-scopes">
        {sortScopes(view.scopes ?? []).map((scope) => (
          <li key={scope}>
            <strong>{scopeText(scope).title}</strong>
            <span className="muted">{scopeText(scope).text}</span>
          </li>
        ))}
      </ul>
      <Errors texts={error ? [error] : []} />
      <div className="oauth-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void answer(true)}>
          Erlauben
        </button>
        <button type="button" disabled={busy} onClick={() => void answer(false)}>
          Ablehnen
        </button>
      </div>
      <p className="hint">Dein Passwort erfährt {name} nie. Du kannst den Zugriff jederzeit beim Dienst beenden.</p>
    </AuthLayout>
  );
}

type LogoutView = { client?: { name?: string }; rpInitiated?: boolean };

/** /oauth/logout?logout_challenge=…: a service asks to sign the person out; no session is needed for this page. */
export function OAuthLogoutPage() {
  const challenge = useSearchParams()[0].get('logout_challenge');
  if (!challenge) {
    return <Missing title="Abmelden" />;
  }
  return <Logout challenge={challenge} />;
}

function Logout({ challenge }: { challenge: string }) {
  const api = useApi();
  const { state, logout } = useAuth();
  const started = useRef(false);
  const [view, setView] = useState<LogoutView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    api
      .GET('/api/oauth/logout', { params: { query: { challenge } } })
      .then((result) => setView(unwrap(result) as LogoutView))
      .catch((e: unknown) => setError(message(e)));
  }, [api, challenge]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api.POST('/api/oauth/logout/accept', { body: { challenge } });
      const next = unwrap(result).redirectTo;
      // Also end the Kratos session of this browser, then go on to where Hydra sends us
      if (state.status === 'signedIn' || state.status === 'needsSecondFactor') {
        await logout().catch(() => undefined);
      }
      if (!go(next)) {
        window.location.assign('/login');
      }
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await api.POST('/api/oauth/logout/reject', { body: { challenge } });
    } catch {
      // The request may have expired; the person stays signed in either way
    }
    setDeclined(true);
    setBusy(false);
  };

  if (declined) {
    return (
      <AuthLayout title="Abmelden">
        <p>Du bleibst angemeldet.</p>
        <p className="hint">
          <Link to="/">Zur Startseite</Link>
        </p>
      </AuthLayout>
    );
  }
  if (error && !view) {
    return (
      <AuthLayout title="Abmelden">
        <Errors texts={[error]} />
        <p className="hint">
          <Link to="/">Zur Startseite</Link>
        </p>
      </AuthLayout>
    );
  }
  if (!view) {
    return <Working title="Abmelden" text="Lade …" />;
  }
  const name = view.client?.name ?? 'Ein Dienst';
  return (
    <AuthLayout title="Abmelden">
      <p>
        <strong>{name}</strong> möchte dich abmelden. Damit endet auch deine Anmeldung in dieser Smart-Home-Oberfläche.
      </p>
      <Errors texts={error ? [error] : []} />
      <div className="oauth-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void confirm()}>
          Abmelden
        </button>
        <button type="button" disabled={busy} onClick={() => void decline()}>
          Angemeldet bleiben
        </button>
      </div>
    </AuthLayout>
  );
}
