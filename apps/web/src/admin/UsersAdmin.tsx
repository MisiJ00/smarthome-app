import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useToast } from '../components/Toasts';
import { useCreateUser, useRoles, useUsers, type CreatedUser, type SetupCode } from './adminApi';
import { Copyable, Panel, errorText, formatTime, roleLabel } from './ui';

/** All users; new accounts get a setup code instead of a password. */
export function UsersAdmin() {
  const users = useUsers();
  const [created, setCreated] = useState<CreatedUser | null>(null);
  return (
    <div className="stack">
      <NewUser onCreated={setCreated} />
      {created?.setupCode && <SetupCodeCard name={created.user?.name ?? ''} code={created.setupCode} onClose={() => setCreated(null)} />}
      <Panel title="Benutzer">
        {users.isPending && <p className="muted">Lade …</p>}
        <div className="list">
          {(users.data ?? []).map((u) => (
            <Link key={u.id} to={String(u.id)} className="item item-link">
              <div className="item-main">
                <strong>
                  {u.name} {!u.active && <span className="badge badge-warn">deaktiviert</span>}
                </strong>
                <span className="muted">{u.machine ? 'Maschinen-User (KI, Skripte)' : [u.username, u.email].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="muted">{(u.roles ?? []).map(roleLabel).join(', ') || 'keine Rolle'}</span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function NewUser({ onCreated }: { onCreated: (user: CreatedUser) => void }) {
  const roles = useRoles();
  const create = useCreateUser();
  const toast = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>(['bewohner']);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name: name.trim(), username: username.trim(), email: email.trim(), roles: selected },
      {
        onSuccess: (user) => {
          onCreated(user);
          setName('');
          setUsername('');
          setEmail('');
        },
        onError: (e) => toast('error', errorText(e)),
      },
    );
  };

  return (
    <Panel title="Neues Konto">
      <form className="form-grid" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </label>
        <label>
          Benutzername
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            pattern="[a-z0-9._\-]{3,32}"
            title="3 bis 32 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich"
            required
          />
        </label>
        <label>
          E-Mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <fieldset>
          <legend>Rollen</legend>
          <div className="chips">
            {(roles.data ?? [])
              .filter((r) => r.name !== 'ki')
              .map((r) => (
                <label key={r.id} className="chip">
                  <input
                    type="checkbox"
                    checked={selected.includes(r.name!)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, r.name!] : selected.filter((n) => n !== r.name))}
                  />
                  {roleLabel(r.name)}
                </label>
              ))}
          </div>
        </fieldset>
        <div>
          <button type="submit" className="primary" disabled={create.isPending}>
            Konto anlegen
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Shown once: the person needs link and code to choose their password. */
export function SetupCodeCard({ name, code, onClose }: { name: string; code: SetupCode; onClose: () => void }) {
  return (
    <Panel
      title={`Einrichtungscode für ${name}`}
      actions={
        <button type="button" className="ghost" onClick={onClose}>
          Schließen
        </button>
      }
    >
      <p className="muted">
        Gib {name} den Link und den Code (z. B. per Messenger). Gültig bis {formatTime(code.expiresAt)}. Der Code wird nur jetzt angezeigt; bei Bedarf beim
        Benutzer einen neuen erzeugen.
      </p>
      <Copyable label="Link" value={code.link ?? ''} />
      <Copyable label="Code" value={code.code ?? ''} />
    </Panel>
  );
}
