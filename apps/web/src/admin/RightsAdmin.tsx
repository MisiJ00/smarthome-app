import { useState, type FormEvent } from 'react';

import { useToast } from '../components/Toasts';
import { useCreateRole, useDeleteRole, useRoles } from './adminApi';
import { GrantsEditor } from './GrantsEditor';
import { Panel, errorText, roleLabel } from './ui';

/** Roles and their rights. Rights for one person are on the user's page. */
export function RightsAdmin() {
  const roles = useRoles();
  const create = useCreateRole();
  const remove = useDeleteRole();
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState('');
  const current = roles.data?.find((r) => r.id === selected) ?? roles.data?.find((r) => r.name === 'bewohner');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(name.trim(), {
      onSuccess: () => setName(''),
      onError: (e) => toast('error', errorText(e)),
    });
  };

  return (
    <div className="stack">
      <Panel title="Rollen">
        <div className="chips">
          {(roles.data ?? []).map((r) => (
            <button key={r.id} type="button" className={`chip ${current?.id === r.id ? 'chip-active' : ''}`} onClick={() => setSelected(r.id!)}>
              {roleLabel(r.name)} <span className="muted">({r.userCount})</span>
            </button>
          ))}
        </div>
        <form className="item-form" onSubmit={submit}>
          <input
            aria-label="Neue Rolle"
            placeholder="eigene Rolle, z. B. nachbar"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            pattern="[a-z0-9_\-]{2,32}"
            title="2 bis 32 Zeichen: Kleinbuchstaben, Ziffern, Bindestrich, Unterstrich"
            required
          />
          <button type="submit" disabled={create.isPending}>
            Rolle anlegen
          </button>
        </form>
      </Panel>
      {current?.id !== undefined && (
        <>
          {current.name === 'admin' ? (
            <Panel title="Admin">
              <p className="muted">Admins dürfen alles außer gesperrten Aktionen und brauchen keine Rechte.</p>
            </Panel>
          ) : (
            <GrantsEditor key={current.id} subjectType="role" subjectId={current.id} title={`Rechte der Rolle ${roleLabel(current.name)}`} />
          )}
          {!current.system && (
            <p>
              <button
                type="button"
                className="danger"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(current.id!, {
                    onSuccess: () => setSelected(null),
                    onError: (e) => toast('error', errorText(e)),
                  })
                }
              >
                Rolle {current.name} löschen
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
