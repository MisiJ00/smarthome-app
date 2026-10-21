import { useState } from 'react';

import { useDevices } from '../api';
import { useAudit, useUsers, type AuditEntry, type AuditFilter } from './adminApi';
import { Panel, actionLabel, formatTime } from './ui';

const RESULTS: Record<NonNullable<AuditEntry['result']>, string> = {
  sent: 'ausgeführt',
  denied: 'kein Recht',
  locked: 'gesperrt',
  pending: 'wartet auf Freigabe',
  approved: 'freigegeben',
  rejected: 'abgelehnt',
  expired: 'abgelaufen',
  registered: 'registriert',
  revoked: 'gesperrt (Handy)',
  started: 'gestartet',
  stopped: 'beendet',
};

const VIA: Record<NonNullable<AuditEntry['via']>, string> = { web: 'Web', app: 'App', widget: 'Widget', ki: 'KI', system: 'System' };

const PAGE_SIZE = 50;

/** Who did what when, newest first. */
export function AuditAdmin() {
  const users = useUsers();
  const devices = useDevices();
  const [filter, setFilter] = useState<AuditFilter>({ page: 0, size: PAGE_SIZE });
  const audit = useAudit(filter);
  const set = (patch: Partial<AuditFilter>) => setFilter((f) => ({ ...f, ...patch, page: patch.page ?? 0 }));
  const total = audit.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Panel title="Protokoll">
      <div className="filters">
        <select aria-label="Benutzer" value={filter.userId ?? ''} onChange={(e) => set({ userId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Alle Benutzer</option>
          {(users.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select aria-label="Gerät" value={filter.deviceId ?? ''} onChange={(e) => set({ deviceId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Alle Geräte</option>
          {(devices.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Ergebnis"
          value={filter.result ?? ''}
          onChange={(e) => set({ result: (e.target.value || undefined) as AuditFilter['result'] })}
        >
          <option value="">Alle Ergebnisse</option>
          {Object.entries(RESULTS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <select aria-label="Über" value={filter.via ?? ''} onChange={(e) => set({ via: (e.target.value || undefined) as AuditFilter['via'] })}>
          <option value="">Alle Wege</option>
          {Object.entries(VIA).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <label className="date">
          ab
          <input type="date" value={filter.from?.slice(0, 10) ?? ''} onChange={(e) => set({ from: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Wer</th>
              <th>Gerät</th>
              <th>Was</th>
              <th>Ergebnis</th>
              <th>Über</th>
            </tr>
          </thead>
          <tbody>
            {(audit.data?.items ?? []).map((e) => (
              <tr key={e.id}>
                <td>{formatTime(e.ts)}</td>
                <td>{e.userName ?? '–'}</td>
                <td>{e.deviceName ?? '–'}</td>
                <td title={JSON.stringify(e.params)}>{describe(e)}</td>
                <td>
                  <span className={`badge ${resultClass(e.result)}`}>{e.result ? RESULTS[e.result] : ''}</span>
                </td>
                <td>{e.via ? VIA[e.via] : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total === 0 && !audit.isPending && <p className="muted">Keine Einträge.</p>}
      <div className="row pager">
        <button type="button" disabled={filter.page === 0} onClick={() => set({ page: filter.page - 1 })}>
          Neuer
        </button>
        <span className="muted">
          Seite {filter.page + 1} von {pages} · {total} Einträge
        </span>
        <button type="button" disabled={filter.page + 1 >= pages} onClick={() => set({ page: filter.page + 1 })}>
          Älter
        </button>
      </div>
    </Panel>
  );
}

function describe(entry: AuditEntry): string {
  const params = entry.params ?? {};
  if (entry.action === 'permit_join') {
    return `Anlernmodus${params['seconds'] ? ` (${String(params['seconds'])} s)` : ''}`;
  }
  if (entry.action === 'trusted_device') {
    return `Handy ${String(params['name'] ?? '')}`;
  }
  const values = Object.entries(params)
    .filter(([key]) => !['requestedBy', 'approvedWith'].includes(key))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
  const extra = params['approvedWith'] ? ` · per ${String(params['approvedWith'])}` : '';
  return `${actionLabel(entry.action ?? '')}${values ? ` (${values})` : ''}${extra}`;
}

function resultClass(result: AuditEntry['result']): string {
  switch (result) {
    case 'sent':
    case 'approved':
      return 'badge-ok';
    case 'denied':
    case 'locked':
    case 'rejected':
      return 'badge-error';
    case 'pending':
    case 'expired':
      return 'badge-warn';
    default:
      return '';
  }
}
