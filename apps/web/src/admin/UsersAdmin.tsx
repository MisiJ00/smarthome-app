import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { Icon } from '../components/Icon';
import { useToast } from '../components/Toasts';
import { useCreateUser, useRoles, useUsers, type CreatedUser, type SetupCode } from './adminApi';
import { Copyable, FormDialog, Panel, SkeletonRows, StatusBadge, errorText, formatTime, roleLabel } from './ui';

/** All users; new accounts get a setup code instead of a password. */
export function UsersAdmin() {
  const users = useUsers();
  const navigate = useNavigate();
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <div className="stack">
      {created?.setupCode && <SetupCodeCard name={created.user?.name ?? ''} code={created.setupCode} onClose={() => setCreated(null)} />}
      <Panel
        title="Benutzer"
        actions={
          <button type="button" className="primary" onClick={() => setAdding(true)}>
            <UserPlus size={16} aria-hidden />
            Neues Konto
          </button>
        }
      >
        {users.isPending && <SkeletonRows />}
        {users.data && users.data.length > 0 && (
          <div className="table-wrap">
            <table className="table adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Anmeldung</th>
                  <th>Rollen</th>
                  <th>Status</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="adm-row-link" onClick={() => navigate(String(u.id))}>
                    <td>
                      {/* The row navigates as well; without stopPropagation a click on the link would navigate twice */}
                      <Link to={String(u.id)} className="adm-strong-link" onClick={(e) => e.stopPropagation()}>
                        {u.name}
                      </Link>
                    </td>
                    <td className="muted">{u.machine ? 'Maschinen-User (KI, Skripte)' : [u.username, u.email].filter(Boolean).join(' · ')}</td>
                    <td>
                      <span className="adm-badges">
                        {(u.roles ?? []).length > 0 ? (
                          (u.roles ?? []).map((r) => (
                            <StatusBadge key={r} tone={r === 'admin' ? 'accent' : undefined}>
                              {roleLabel(r)}
                            </StatusBadge>
                          ))
                        ) : (
                          <span className="muted">keine Rolle</span>
                        )}
                      </span>
                    </td>
                    <td>{u.active ? <StatusBadge tone="ok">aktiv</StatusBadge> : <StatusBadge tone="warn">deaktiviert</StatusBadge>}</td>
                    <td className="adm-cell-end">
                      <Icon name="next" size={18} className="muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <FormDialog open={adding} onOpenChange={setAdding} title="Neues Konto" description="Die Person wählt ihr Passwort selbst, mit einem Einrichtungscode.">
        <NewUser
          onCreated={(user) => {
            setCreated(user);
            setAdding(false);
          }}
        />
      </FormDialog>
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
    <form className="adm-form" onSubmit={submit}>
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
      <div className="adm-form-actions">
        <button type="submit" className="primary" disabled={create.isPending}>
          Konto anlegen
        </button>
      </div>
    </form>
  );
}

/** Shown once: the person needs link and code to choose their password. */
export function SetupCodeCard({ name, code, onClose }: { name: string; code: SetupCode; onClose: () => void }) {
  return (
    <Panel
      className="adm-highlight"
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
