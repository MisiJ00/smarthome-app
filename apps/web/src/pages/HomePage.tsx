import { useCallback, useState } from 'react';
import { Link } from 'react-router';

import type { LiveEvent } from '@smarthome/api-client';
import { groupByRoom } from '@smarthome/core';

import { useDevices, useMe, useRooms } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { Confirmations } from '../components/Confirmations';
import { DeviceCard } from '../components/DeviceCard';
import { applyTheme, nextTheme, storedTheme, themeLabel, type Theme } from '../components/theme';
import { useToast } from '../components/Toasts';
import { useLiveEvents, type LiveStatus } from '../live/useLiveEvents';

/** Devices by room, switchable, with live state. */
export function HomePage() {
  const me = useMe();
  const rooms = useRooms();
  const devices = useDevices();
  const toast = useToast();

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === 'confirmation.created' && event.data.canDecide) {
        toast('info', `${event.data.userName} möchte ${event.data.deviceName} öffnen`);
      }
      if (event.type === 'confirmation.approved' && event.data.mine) {
        toast('success', `${event.data.deviceName}: freigegeben`);
      }
      if (event.type === 'confirmation.rejected' && event.data.mine) {
        toast('error', `${event.data.deviceName}: abgelehnt`);
      }
    },
    [toast],
  );
  const live = useLiveEvents(onEvent);

  const groups = groupByRoom(rooms.data ?? [], devices.data ?? []);
  const loading = rooms.isPending || devices.isPending;
  const failed = rooms.isError || devices.isError;

  return (
    <div className="app">
      <Header name={me.data?.name} live={live} />
      <main className="content">
        <Confirmations />
        {loading && <p className="muted">Lade Geräte …</p>}
        {failed && <p className="form-errors">Die Geräte konnten nicht geladen werden.</p>}
        {!loading && !failed && groups.length === 0 && (
          <div className="empty">
            <h2>Noch keine Geräte</h2>
            <p className="muted">Sobald ein Admin Geräte übernommen und dir Rechte gegeben hat, erscheinen sie hier.</p>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.room?.id ?? 'none'} className="room">
            <h2>{group.room?.name ?? 'Ohne Raum'}</h2>
            <div className="grid">
              {group.devices.map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function Header({ name, live }: { name: string | undefined; live: LiveStatus }) {
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
        <span>Smart Home</span>
        <span className={`live live-${live}`} title={liveText[live]} aria-label={liveText[live]} />
      </div>
      <nav className="row">
        <span className="muted hide-small">{name}</span>
        <button type="button" className="ghost" onClick={toggleTheme} title={themeLabel[theme]} aria-label={themeLabel[theme]}>
          {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
        </button>
        <Link to="/account" className="ghost">
          Passwort
        </Link>
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
