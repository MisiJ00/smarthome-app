import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import type { LiveEvent } from '@smarthome/api-client';

import { adminSections } from '../admin/AdminLayout';
import { useMe } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { useLiveEvents, type LiveStatus } from '../live/useLiveEvents';
import { Icon } from './Icon';
import { modeIcon, modeLabel, nextMode, useAppearance } from './theme';
import { useToast } from './Toasts';

/**
 * The frame for everything behind the login, and its one live connection: a side bar on wide screens, a slim header
 * with a tab bar at the bottom on small ones (CSS decides which shows, at 900 px).
 */
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
    <div className="shell">
      <Sidebar name={me.data?.name} live={live} isAdmin={isAdmin} />
      <MobileHeader live={live} />
      <div className="shell-main">
        <Outlet />
      </div>
      <TabBar isAdmin={isAdmin} />
    </div>
  );
}

function Sidebar({ name, live, isAdmin }: { name: string | undefined; live: LiveStatus; isAdmin: boolean }) {
  const { logout } = useAuth();
  const inAdmin = useLocation().pathname.startsWith('/admin');
  return (
    <aside className="sidebar">
      <Brand />
      <LiveBadge live={live} />
      <nav className="side-nav" aria-label="Hauptnavigation">
        <NavLink to="/" end className="side-link">
          <Icon name="devices" size={18} />
          Geräte
        </NavLink>
        <NavLink to="/appearance" className="side-link">
          <Icon name="appearance" size={18} />
          Darstellung
        </NavLink>
        <NavLink to="/account" className="side-link">
          <Icon name="account" size={18} />
          Konto
        </NavLink>
        {isAdmin && (
          <>
            <NavLink to="/admin" className="side-link">
              <Icon name="settings" size={18} />
              Admin
            </NavLink>
            {inAdmin && (
              <div className="side-sub" role="group" aria-label="Verwaltung">
                {adminSections.map((section) => (
                  <NavLink key={section.to} to={`/admin/${section.to}`} className="side-link side-link-sub">
                    <Icon name={section.icon} size={16} />
                    {section.label}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>
      <div className="sidebar-foot">
        {name && (
          <p className="sidebar-user">
            <Icon name="account" size={16} />
            <span>{name}</span>
          </p>
        )}
        <ThemeButton withLabel />
        <button type="button" className="ghost side-link" onClick={() => void logout()}>
          <Icon name="logout" size={18} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}

function MobileHeader({ live }: { live: LiveStatus }) {
  const { logout } = useAuth();
  return (
    <header className="mobilebar">
      <Brand />
      <span className={`live live-${live}`} title={liveText[live]} aria-label={liveText[live]} role="img" />
      <div className="mobilebar-actions">
        <ThemeButton />
        <button type="button" className="ghost icon-button" onClick={() => void logout()} title="Abmelden" aria-label="Abmelden">
          <Icon name="logout" />
        </button>
      </div>
    </header>
  );
}

function TabBar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <NavLink to="/" end className="tabbar-link">
        <Icon name="devices" size={22} />
        <span>Geräte</span>
      </NavLink>
      <NavLink to="/appearance" className="tabbar-link">
        <Icon name="appearance" size={22} />
        <span>Darstellung</span>
      </NavLink>
      <NavLink to="/account" className="tabbar-link">
        <Icon name="account" size={22} />
        <span>Konto</span>
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className="tabbar-link">
          <Icon name="settings" size={22} />
          <span>Admin</span>
        </NavLink>
      )}
    </nav>
  );
}

function Brand() {
  return (
    <NavLink to="/" end className="brand" aria-label="Smart Home, zu den Geräten">
      <span className="logo" aria-hidden="true">
        <Icon name="home" size={18} />
      </span>
      <span>Smart Home</span>
    </NavLink>
  );
}

function LiveBadge({ live }: { live: LiveStatus }) {
  return (
    <p className={`live-badge live-badge-${live}`} role="status">
      <span className={`live live-${live}`} aria-hidden="true" />
      {liveText[live]}
    </p>
  );
}

/** Quick switch System → Hell → Dunkel → Schwarz; with the label in the side bar, as an icon in the small header. */
function ThemeButton({ withLabel = false }: { withLabel?: boolean }) {
  const { appearance, updateAppearance } = useAppearance();
  const mode = appearance.mode;
  return (
    <button
      type="button"
      className={withLabel ? 'ghost side-link' : 'ghost icon-button'}
      onClick={() => updateAppearance({ mode: nextMode[mode] })}
      title={modeLabel[mode]}
      aria-label={withLabel ? undefined : modeLabel[mode]}
    >
      <Icon name={modeIcon[mode]} size={withLabel ? 18 : 20} />
      {withLabel && modeLabel[mode]}
    </button>
  );
}

const liveText: Record<LiveStatus, string> = {
  connecting: 'Verbinde …',
  live: 'Live',
  offline: 'Offline, verbinde neu …',
};
