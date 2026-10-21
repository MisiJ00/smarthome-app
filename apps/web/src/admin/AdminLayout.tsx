import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: 'devices', label: 'Geräte' },
  { to: 'rooms', label: 'Räume' },
  { to: 'users', label: 'Benutzer' },
  { to: 'rights', label: 'Rollen & Rechte' },
  { to: 'audit', label: 'Protokoll' },
];

/** Admin area: only reachable for admins (RequireAdmin), the backend checks every request anyway. */
export function AdminLayout() {
  return (
    <main className="content admin">
      <nav className="tabs" aria-label="Verwaltung">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className="tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </main>
  );
}
