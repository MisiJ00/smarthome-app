import { useState, type FormEvent } from 'react';

import { actionLabel } from '@smarthome/core';

import { useDevices, useRooms } from '../api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toasts';
import { useCreateGrant, useDeleteGrant, useGrants, useUpdateGrant, type CreateGrant } from './adminApi';
import { EmptyState, Panel, SkeletonRows, errorText } from './ui';

type Scope = NonNullable<CreateGrant['scopeType']>;
type GrantAction = NonNullable<CreateGrant['action']>;

const ACTIONS: GrantAction[] = ['view', 'control', 'configure', 'unlock'];

/** The grants of one role or user: add, require confirmation or not, remove. */
export function GrantsEditor({ subjectType, subjectId, title }: { subjectType: 'role' | 'user'; subjectId: number; title: string }) {
  const grants = useGrants(subjectType, subjectId);
  const rooms = useRooms();
  const devices = useDevices();
  const create = useCreateGrant();
  const update = useUpdateGrant();
  const remove = useDeleteGrant();
  const toast = useToast();
  const [scopeType, setScopeType] = useState<Scope>('all');
  const [scopeId, setScopeId] = useState('');
  const [action, setAction] = useState<GrantAction>('control');
  const [confirm, setConfirm] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        subjectType,
        subjectId,
        scopeType,
        ...(scopeType !== 'all' ? { scopeId: Number(scopeId) } : {}),
        action,
        requiresConfirmation: confirm || action === 'unlock',
      },
      { onError: (e) => toast('error', errorText(e)) },
    );
  };

  const scopeOptions = scopeType === 'room' ? (rooms.data ?? []) : (devices.data ?? []);

  return (
    <Panel title={title}>
      {grants.isPending && <SkeletonRows rows={2} />}
      {grants.data?.length === 0 && <EmptyState icon="rights">Keine.</EmptyState>}
      {(grants.data?.length ?? 0) > 0 && (
        <div className="table-wrap">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Recht</th>
                <th>Gilt für</th>
                <th>Freigabe</th>
                <th>
                  <span className="adm-visually-hidden">Entfernen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(grants.data ?? []).map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{actionLabel(g.action ?? '')}</strong>
                  </td>
                  <td>{g.scopeType === 'all' ? 'alle Geräte' : g.scopeType === 'room' ? `Raum ${g.scopeName}` : g.scopeName}</td>
                  <td>
                    <label className="chip">
                      <input
                        type="checkbox"
                        checked={g.requiresConfirmation ?? false}
                        disabled={g.action === 'unlock' || update.isPending}
                        onChange={(e) => update.mutate({ id: g.id!, requiresConfirmation: e.target.checked }, { onError: (err) => toast('error', errorText(err)) })}
                      />
                      mit Freigabe
                    </label>
                  </td>
                  <td className="adm-cell-end">
                    <button
                      type="button"
                      className="ghost icon-button adm-icon-button adm-icon-danger"
                      aria-label="Recht entfernen"
                      onClick={() => remove.mutate(g.id!, { onError: (e) => toast('error', errorText(e)) })}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="item-form wrap adm-toolbar" onSubmit={submit}>
        <select aria-label="Aktion" value={action} onChange={(e) => setAction(e.target.value as GrantAction)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
        <select
          aria-label="Gilt für"
          value={scopeType}
          onChange={(e) => {
            setScopeType(e.target.value as Scope);
            setScopeId('');
          }}
        >
          <option value="all">alle Geräte</option>
          <option value="room">einen Raum</option>
          <option value="device">ein Gerät</option>
        </select>
        {scopeType !== 'all' && (
          <select aria-label={scopeType === 'room' ? 'Raum' : 'Gerät'} value={scopeId} onChange={(e) => setScopeId(e.target.value)} required>
            <option value="">Bitte wählen</option>
            {scopeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <label className="chip">
          <input type="checkbox" checked={confirm || action === 'unlock'} disabled={action === 'unlock'} onChange={(e) => setConfirm(e.target.checked)} />
          mit Freigabe
        </label>
        <button type="submit" className="primary" disabled={create.isPending}>
          <Icon name="add" size={16} />
          Hinzufügen
        </button>
      </form>
      <p className="muted small">Jedes Recht erlaubt auch das Sehen. Aufschließen braucht immer eine Freigabe. Admins brauchen keine Rechte.</p>
    </Panel>
  );
}
