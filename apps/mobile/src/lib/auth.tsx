import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import * as kratos from './kratos';
import { loadServer, saveServer } from './server';

export type AuthState =
  | { status: 'loading' }
  /** No server address yet. */
  | { status: 'noServer' }
  | { status: 'signedOut'; server: string }
  | { status: 'needsSecondFactor'; server: string }
  | { status: 'signedIn'; server: string; session: kratos.Session };

interface AuthContextValue {
  state: AuthState;
  setServer: (url: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  secondFactor: (code: string, backupCode: boolean) => Promise<void>;
  logout: () => Promise<void>;
  /** The JWT for the backend (5 minutes), fetched again shortly before it expires. */
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The Kratos session token; only in the Android Keystore / iOS Keychain, never in plain storage. */
const SESSION_KEY = 'smarthome.session';
const REFRESH_MARGIN = 30;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const server = useRef<string | null>(null);
  const sessionToken = useRef<string | null>(null);
  const token = useRef<{ jwt: string; exp: number } | null>(null);
  const pending = useRef<Promise<string | null> | null>(null);

  /** Reads the session (and a fresh JWT) with the stored session token. */
  const load = useCallback(async (): Promise<string | null> => {
    const url = server.current;
    if (!url) {
      setState({ status: 'noServer' });
      return null;
    }
    const stored = sessionToken.current ?? (await SecureStore.getItemAsync(SESSION_KEY));
    if (!stored) {
      setState({ status: 'signedOut', server: url });
      return null;
    }
    sessionToken.current = stored;
    try {
      const session = await kratos.whoami(url, stored);
      if (!session?.tokenized) {
        await forget();
        setState({ status: 'signedOut', server: url });
        return null;
      }
      token.current = { jwt: session.tokenized, exp: kratos.jwtExpiry(session.tokenized) };
      setState({ status: 'signedIn', server: url, session });
      return session.tokenized;
    } catch (error) {
      token.current = null;
      if (error instanceof kratos.KratosError && error.id === 'session_aal2_required') {
        setState({ status: 'needsSecondFactor', server: url });
      } else {
        // Server not reachable: keep the session, show the login screen with the error there
        setState({ status: 'signedOut', server: url });
      }
      return null;
    }
  }, []);

  const loadOnce = useCallback(() => {
    pending.current ??= load().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [load]);

  async function forget() {
    sessionToken.current = null;
    token.current = null;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  useEffect(() => {
    void (async () => {
      server.current = await loadServer();
      await loadOnce();
    })();
  }, [loadOnce]);

  const setServer = useCallback(
    async (url: string) => {
      server.current = await saveServer(url);
      await forget();
      setState({ status: 'signedOut', server: server.current });
    },
    [],
  );

  const login = useCallback(
    async (identifier: string, password: string) => {
      const url = server.current!;
      const session = await kratos.login(url, identifier.trim(), password);
      sessionToken.current = session;
      await SecureStore.setItemAsync(SESSION_KEY, session);
      await loadOnce();
    },
    [loadOnce],
  );

  const secondFactor = useCallback(
    async (code: string, backupCode: boolean) => {
      await kratos.secondFactor(server.current!, sessionToken.current!, code.replace(/\s/g, ''), backupCode);
      await loadOnce();
    },
    [loadOnce],
  );

  const logout = useCallback(async () => {
    const url = server.current;
    const stored = sessionToken.current;
    if (url && stored) {
      await kratos.logout(url, stored).catch(() => {});
    }
    await forget();
    setState(url ? { status: 'signedOut', server: url } : { status: 'noServer' });
  }, []);

  const getToken = useCallback(async () => {
    const current = token.current;
    if (current && current.exp - Date.now() / 1000 > REFRESH_MARGIN) {
      return current.jwt;
    }
    return loadOnce();
  }, [loadOnce]);

  const value = useMemo(
    () => ({ state, setServer, login, secondFactor, logout, getToken }),
    [state, setServer, login, secondFactor, logout, getToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth outside of AuthProvider');
  }
  return value;
}

/** The server address while signed in (the screens behind the login always have one). */
export function useServer(): string {
  const { state } = useAuth();
  return 'server' in state ? state.server : '';
}
