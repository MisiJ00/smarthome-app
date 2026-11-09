import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { AUDIT_RESULTS, AUDIT_VIA, auditDescription, auditTone } from '@smarthome/core';

import { useDevices } from '../api';
import { useAudit, useUsers, type AuditFilter } from './adminApi';
import { EmptyState, Panel, SkeletonRows, StatusBadge, formatTime } from './ui';

const RESULTS = AUDIT_RESULTS;
const VIA = AUDIT_VIA;

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
      <div className="filters adm-toolbar">
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
      {audit.isPending && <SkeletonRows rows={5} />}
      <div className="table-wrap">
        <table className="table adm-table adm-audit">
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
                <td className="muted adm-time">{formatTime(e.ts)}</td>
                <td>{e.userName ?? '–'}</td>
                <td>{e.deviceName ?? '–'}</td>
                <td title={JSON.stringify(e.params)}>{auditDescription(e)}</td>
                <td>{e.result && <StatusBadge tone={auditTone(e.result)}>{RESULTS[e.result]}</StatusBadge>}</td>
                <td className="muted">{e.via ? VIA[e.via] : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total === 0 && !audit.isPending && <EmptyState icon="audit">Keine Einträge.</EmptyState>}
      <div className="row pager adm-pager">
        <button type="button" disabled={filter.page === 0} onClick={() => set({ page: filter.page - 1 })}>
          <ChevronLeft size={16} aria-hidden />
          Neuer
        </button>
        <span className="muted">
          Seite {filter.page + 1} von {pages} · {total} Einträge
        </span>
        <button type="button" disabled={filter.page + 1 >= pages} onClick={() => set({ page: filter.page + 1 })}>
          Älter
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </Panel>
  );
}
