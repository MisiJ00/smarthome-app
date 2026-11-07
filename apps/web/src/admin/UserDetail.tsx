import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { actionLabel } from '@smarthome/core';

import { Icon } from '../components/Icon';
import { useToast } from '../components/Toasts';
import {
  useDeleteUser,
  useEffectivePermissions,
  useNewSetupCode,
  useRevokeTrustedDevice,
  useRoles,
  useSetRoles,
  useTrustedDevices,
  useUpdateUser,
  useUser,
  type SetupCode,
} from './adminApi';
import { GrantsEditor } from './GrantsEditor';
import { SetupCodeCard } from './UsersAdmin';
import { EmptyState, MenuItem, MenuSeparator, Panel, RowMenu, SkeletonRows, StatusBadge, errorText, formatTime, roleLabel } from './ui';

/** One user: roles, active, setup code, phones, own grants and what they may do in effect. */
export function UserDetail() {
  const id = Number(useParams().id);
  const user = useUser(id);
  const roles = useRoles();
  const setRoles = useSetRoles();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const newCode = useNewSetupCode();
  const toast = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState<SetupCode | null>(null);

  if (user.isPending) {
    return <SkeletonRows rows={4} />;
  }
  if (!user.data?.user) {
    return <p className="form-errors">Diesen Benutzer gibt es nicht.</p>;
  }
  const u = user.data.user;
  const current = u.roles ?? [];

  const toggleRole = (name: string, on: boolean) =>
    setRoles.mutate(
      { id, roles: on ? [...current, name] : current.filter((r) => r !== name) },
      { onError: (e) => toast('error', errorText(e)) },
    );
  const setActive = (active: boolean) =>
    update.mutate({ id, body: { active } }, { onError: (e) => toast('error', errorText(e)) });
  const removeUser = () => {
    if (window.confirm(`${u.name} endgültig löschen? Das Konto wird auch in Kratos entfernt.`)) {
      remove.mutate(id, { onSuccess: () => navigate('/admin/users'), onError: (e) => toast('error', errorText(e)) });
    }
  };

  return (
    <div className="stack">
      <p>
        <Link to="/admin/users" className="adm-back">
          <ArrowLeft size={16} aria-hidden />
          Alle Benutzer
        </Link>
      </p>
      <Panel
        title={
          <span className="adm-title-badges">
            {u.name ?? ''}
            {u.active ? <StatusBadge tone="ok">aktiv</StatusBadge> : <StatusBadge tone="warn">deaktiviert</StatusBadge>}
          </span>
        }
        description={u.machine ? 'Maschinen-User: meldet sich mit API-Token an, kann nicht gelöscht werden.' : [u.username, u.email].filter(Boolean).join(' · ')}
        actions={
          !u.machine && (
            <RowMenu label={`Aktionen für ${u.name}`}>
              <MenuItem
                icon="rights"
                disabled={newCode.isPending || !u.active}
                onSelect={() => newCode.mutate(id, { onSuccess: setCode, onError: (e) => toast('error', errorText(e)) })}
              >
                Neuer Einrichtungscode
              </MenuItem>
              <MenuItem icon={u.active ? 'offline' : 'check'} disabled={update.isPending} onSelect={() => setActive(!u.active)}>
                {u.active ? 'Deaktivieren' : 'Aktivieren'}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon="delete" danger disabled={remove.isPending} onSelect={removeUser}>
                Löschen
              </MenuItem>
            </RowMenu>
          )
        }
      >
        <fieldset>
          <legend>Rollen</legend>
          <div className="chips">
            {(roles.data ?? []).map((r) => (
              <label key={r.id} className="chip">
                <input type="checkbox" checked={current.includes(r.name!)} disabled={setRoles.isPending} onChange={(e) => toggleRole(r.name!, e.target.checked)} />
                {roleLabel(r.name)}
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>
      {code && <SetupCodeCard name={u.name ?? ''} code={code} onClose={() => setCode(null)} />}
      <GrantsEditor subjectType="user" subjectId={id} title="Eigene Rechte (zusätzlich zu den Rollen)" />
      <EffectivePanel id={id} />
      {!u.machine && <PhonesPanel userId={id} />}
    </div>
  );
}

function EffectivePanel({ id }: { id: number }) {
  const effective = useEffectivePermissions(id);
  const data = effective.data;
  const devices = data?.devices ?? [];
  return (
    <Panel title="Darf effektiv">
      {effective.isPending && <SkeletonRows rows={2} />}
      {data?.admin && <p className="muted">Admin: darf alles, außer gesperrten Aktionen.</p>}
      {data && !data.admin && devices.length === 0 && <EmptyState icon="device">Keine Geräte.</EmptyState>}
      {devices.length > 0 && (
        <div className="table-wrap">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Gerät</th>
                <th>Rechte</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.deviceId}>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td className="adm-cell-wrap">
                    <span className="adm-badges">
                      {(d.permissions ?? []).map((p) => (
                        <StatusBadge key={p.action} tone={p.requiresConfirmation ? 'warn' : undefined} icon={p.requiresConfirmation ? 'approval' : undefined}>
                          {actionLabel(p.action ?? '') + (p.requiresConfirmation ? ' (mit Freigabe)' : '')}
                        </StatusBadge>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function PhonesPanel({ userId }: { userId: number }) {
  const phones = useTrustedDevices(userId);
  const revoke = useRevokeTrustedDevice(userId);
  const toast = useToast();
  return (
    <Panel title="Handys für Freigaben (Face ID / Fingerabdruck)">
      {phones.isPending && <SkeletonRows rows={1} />}
      {phones.data?.length === 0 && <EmptyState icon="phone">Keine Handys registriert.</EmptyState>}
      {(phones.data?.length ?? 0) > 0 && (
        <div className="table-wrap">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Handy</th>
                <th>seit</th>
                <th>zuletzt benutzt</th>
                <th>Status</th>
                <th>
                  <span className="adm-visually-hidden">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(phones.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="adm-name">
                      <Icon name="phone" size={16} className="muted" />
                      <strong>{p.name}</strong>
                    </span>
                  </td>
                  <td className="muted">{formatTime(p.createdAt)}</td>
                  <td className="muted">{formatTime(p.lastUsed)}</td>
                  <td>{p.active ? <StatusBadge tone="ok">aktiv</StatusBadge> : <StatusBadge tone="error">gesperrt {formatTime(p.revokedAt)}</StatusBadge>}</td>
                  <td className="adm-cell-end">
                    {p.active && (
                      <RowMenu label={`Aktionen für ${p.name}`}>
                        <MenuItem
                          icon="lock"
                          danger
                          onSelect={() => {
                            if (window.confirm(`${p.name} sperren? Damit kann es keine Freigaben mehr unterschreiben.`)) {
                              revoke.mutate(p.id!, { onError: (e) => toast('error', errorText(e)) });
                            }
                          }}
                        >
                          Sperren
                        </MenuItem>
                      </RowMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
