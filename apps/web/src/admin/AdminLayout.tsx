import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';

import type { IconName } from '@smarthome/theme';

import { Icon } from '../components/Icon';

/** The parts of the admin area; the side bar (desktop) and the tabs here (mobile) show the same list. */
export const adminSections: { to: string; label: string; icon: IconName }[] = [
  { to: 'devices', label: 'Geräte', icon: 'device' },
  { to: 'rooms', label: 'Räume', icon: 'room' },
  { to: 'users', label: 'Benutzer', icon: 'admin' },
  { to: 'rights', label: 'Rollen & Rechte', icon: 'rights' },
  { to: 'audit', label: 'Protokoll', icon: 'audit' },
];

/** Admin area: only reachable for admins (RequireAdmin), the backend checks every request anyway. */
export function AdminLayout() {
  return (
    <main className="content admin">
      {/* On wide screens the side bar lists these, so the tabs only show on small ones */}
      <nav className="subnav" aria-label="Verwaltung">
        {adminSections.map((section) => (
          <NavLink key={section.to} to={section.to} className="subnav-link">
            <Icon name={section.icon} size={16} />
            {section.label}
          </NavLink>
        ))}
      </nav>
      {/* The admin pages are loaded lazily (App.tsx) */}
      <Suspense
        fallback={
          <div className="page-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            <span className="muted">Lade …</span>
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </main>
  );
}
