import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import type { LiveEvent } from '@smarthome/api-client';

import { useMe } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { useLiveEvents, type LiveStatus } from '../live/useLiveEvents';
import { applyTheme, nextTheme, storedTheme, themeLabel, type Theme } from './theme';
import { useToast } from './Toasts';

/** Header and the one live connection for everything behind the login. */
export function SignedInLayout() {
  const me = useMe();
  const toast = useToast();
  const queries = useQueryClient();
  const isAdmin = me.data?.roles?.includes('admin') ?? false;

  const onEvent = useCallback(
    (event: LiveEvent) => {
      switch (event.type) {
        case 'confirmation.created':
          if (event.data.canDecide) {
            toast('info', `${event.data.userName} möchte ${event.data.deviceName} ${event.data.action === 'unlock' ? 'öffnen' : 'schalten'}`);
          }
          break;
        case 'confirmation.approved':
          if (event.data.mine) {
            toast('success', `${event.data.deviceName}: freigegeben`);
          }
          break;
        case 'confirmation.rejected':
          if (event.data.mine) {
            toast('error', `${event.data.deviceName}: abgelehnt`);
          }
          break;
        case 'pairing.started':
        case 'pairing.stopped':
          void queries.invalidateQueries({ queryKey: ['admin', 'pairing'] });
          break;
        case 'device.discovered':
          void queries.invalidateQueries({ queryKey: ['admin', 'discovered'] });
          toast('info', `Neues Gerät gefunden: ${String(event.data['suggestedName'] ?? '')}`);
          break;
        case 'device.added':
        case 'device.removed':
          void queries.invalidateQueries({ queryKey: ['admin', 'discovered'] });
          break;
        default:
      }
    },
    [toast, queries],
  );
  const live = useLiveEvents(onEvent);

  return (
    <div className="app">
      <Header name={me.data?.name} live={live} isAdmin={isAdmin} />
      <Outlet />
    </div>
  );
}

function Header({ name, live, isAdmin }: { name: string | undefined; live: LiveStatus; isAdmin: boolean }) {
  const { logout } = useAuth();
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const toggleTheme = () => {
    const next = nextTheme[theme];
    applyTheme(next);
    setTheme(next);
  };
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        <span className="hide-small">Smart Home</span>
        <span className={`live live-${live}`} title={liveText[live]} aria-label={liveText[live]} />
        <nav className="tabs-top">
          <NavLink to="/" end className="ghost">
            Start
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className="ghost">
              Verwaltung
            </NavLink>
          )}
        </nav>
      </div>
      <nav className="row">
        <span className="muted hide-small">{name}</span>
        <button type="button" className="ghost" onClick={toggleTheme} title={themeLabel[theme]} aria-label={themeLabel[theme]}>
          {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
        </button>
        <NavLink to="/account" className="ghost hide-small">
          Passwort
        </NavLink>
        <button type="button" className="ghost" onClick={() => void logout()}>
          Abmelden
        </button>
      </nav>
    </header>
  );
}

const liveText: Record<LiveStatus, string> = {
  connecting: 'Verbinde …',
  live: 'Live',
  offline: 'Offline, verbinde neu …',
};
