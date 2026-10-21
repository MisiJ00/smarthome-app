import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { KratosError, jwtExpiry, logout as kratosLogout, whoami, type Session } from './kratos';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Password was right, the second factor (TOTP or backup code) is still missing. */
  | { status: 'needsSecondFactor' }
  | { status: 'signedIn'; session: Session };

interface AuthContextValue {
  state: AuthState;
  /** The JWT for the backend, fetched again shortly before it expires (it lives 5 minutes). */
  getToken: () => Promise<string | null>;
  /** Reads the session again, e.g. after a login. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Fetch a new JWT this many seconds before the old one expires. */
const REFRESH_MARGIN = 30;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const token = useRef<{ jwt: string; exp: number } | null>(null);
  const pending = useRef<Promise<string | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** For the refresh timer, which has to call the current loadOnce. */
  const reload = useRef<() => void>(() => {});

  const load = useCallback(async (): Promise<string | null> => {
    clearTimeout(timer.current);
    try {
      const session = await whoami();
      if (!session?.tokenized) {
        token.current = null;
        setState({ status: 'signedOut' });
        return null;
      }
      const exp = jwtExpiry(session.tokenized);
      token.current = { jwt: session.tokenized, exp };
      setState({ status: 'signedIn', session });
      const wait = Math.max(5, exp - Date.now() / 1000 - REFRESH_MARGIN) * 1000;
      timer.current = setTimeout(() => reload.current(), wait);
      return session.tokenized;
    } catch (error) {
      token.current = null;
      if (error instanceof KratosError && error.id === 'session_aal2_required') {
        setState({ status: 'needsSecondFactor' });
      } else {
        setState({ status: 'signedOut' });
      }
      return null;
    }
  }, []);

  /** One request at a time, however many components ask. */
  const loadOnce = useCallback(() => {
    pending.current ??= load().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [load]);

  useEffect(() => {
    reload.current = () => void loadOnce();
    void loadOnce();
    return () => clearTimeout(timer.current);
  }, [loadOnce]);

  const getToken = useCallback(async () => {
    const current = token.current;
    if (current && current.exp - Date.now() / 1000 > 10) {
      return current.jwt;
    }
    return loadOnce();
  }, [loadOnce]);

  const refresh = useCallback(async () => {
    await loadOnce();
  }, [loadOnce]);

  const logout = useCallback(async () => {
    await kratosLogout();
    clearTimeout(timer.current);
    token.current = null;
    setState({ status: 'signedOut' });
  }, []);

  const value = useMemo(() => ({ state, getToken, refresh, logout }), [state, getToken, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth outside of AuthProvider');
  }
  return value;
}
