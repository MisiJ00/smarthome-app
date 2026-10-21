import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

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
import { Panel, actionLabel, errorText, formatTime, roleLabel } from './ui';

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
    return <p className="muted">Lade …</p>;
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
        <Link to="/admin/users">← Alle Benutzer</Link>
      </p>
      <Panel
        title={u.name ?? ''}
        actions={
          !u.machine && (
            <div className="row">
              <button type="button" disabled={newCode.isPending || !u.active} onClick={() => newCode.mutate(id, { onSuccess: setCode, onError: (e) => toast('error', errorText(e)) })}>
                Neuer Einrichtungscode
              </button>
              <button type="button" onClick={() => setActive(!u.active)} disabled={update.isPending}>
                {u.active ? 'Deaktivieren' : 'Aktivieren'}
              </button>
              <button type="button" className="danger" onClick={removeUser} disabled={remove.isPending}>
                Löschen
              </button>
            </div>
          )
        }
      >
        <p className="muted">
          {u.machine ? 'Maschinen-User: meldet sich mit API-Token an, kann nicht gelöscht werden.' : [u.username, u.email].filter(Boolean).join(' · ')}
          {!u.active && ' · deaktiviert'}
        </p>
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
  return (
    <Panel title="Darf effektiv">
      {data?.admin && <p className="muted">Admin: darf alles, außer gesperrten Aktionen.</p>}
      {data && !data.admin && (data.devices ?? []).length === 0 && <p className="muted">Keine Geräte.</p>}
      <div className="list">
        {(data?.devices ?? []).map((d) => (
          <div key={d.deviceId} className="item">
            <div className="item-main">
              <strong>{d.name}</strong>
              <span className="muted">
                {(d.permissions ?? [])
                  .map((p) => actionLabel(p.action ?? '') + (p.requiresConfirmation ? ' (mit Freigabe)' : ''))
                  .join(', ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PhonesPanel({ userId }: { userId: number }) {
  const phones = useTrustedDevices(userId);
  const revoke = useRevokeTrustedDevice(userId);
  const toast = useToast();
  return (
    <Panel title="Handys für Freigaben (Face ID / Fingerabdruck)">
      {phones.data?.length === 0 && <p className="muted">Keine Handys registriert.</p>}
      <div className="list">
        {(phones.data ?? []).map((p) => (
          <div key={p.id} className="item">
            <div className="item-main">
              <strong>{p.name}</strong>
              <span className="muted">
                seit {formatTime(p.createdAt)} · zuletzt benutzt {formatTime(p.lastUsed)}
                {!p.active && ` · gesperrt ${formatTime(p.revokedAt)}`}
              </span>
            </div>
            {p.active && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (window.confirm(`${p.name} sperren? Damit kann es keine Freigaben mehr unterschreiben.`)) {
                    revoke.mutate(p.id!, { onError: (e) => toast('error', errorText(e)) });
                  }
                }}
              >
                Sperren
              </button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
