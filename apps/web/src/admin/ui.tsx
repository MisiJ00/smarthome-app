import { useEffect, useState, type ReactNode } from 'react';

import { ApiError, type Device } from '@smarthome/api-client';
import { features } from '@smarthome/core';

/** The backend's problem detail, or a general message. */
export function errorText(error: unknown, fallback = 'Das hat nicht geklappt'): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

/** A value with a copy button, e.g. the setup code. */
export function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="copyable">
      <span className="muted">{label}</span>
      <code>{value}</code>
      <button type="button" className="ghost" onClick={copy}>
        {copied ? 'Kopiert' : 'Kopieren'}
      </button>
    </div>
  );
}

/** Seconds left until a point in time, updated every second. */
export function useSecondsLeft(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return until ? Math.max(0, Math.round((new Date(until).getTime() - now) / 1000)) : 0;
}

export function formatTime(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' }) : '–';
}

/**
 * Actions that can be locked for a device, as the backend names them (CommandGuard): switching, locking and
 * setting each value. Already locked ones are always offered so they can be unlocked again.
 */
export function lockableActions(device: Device): string[] {
  const result = new Set<string>();
  for (const feature of features(device.capabilities)) {
    if (!feature.settable) {
      continue;
    }
    if (feature.property === 'state' && feature.kind === 'binary') {
      if (device.type === 'lock') {
        result.add('lock').add('unlock');
      } else {
        result.add('switch_on').add('switch_off');
      }
    } else {
      result.add(`set_${feature.property}`);
    }
  }
  (device.lockedActions ?? []).forEach((a) => result.add(a));
  return [...result];
}

const ACTION_LABELS: Record<string, string> = {
  switch_on: 'Einschalten',
  switch_off: 'Ausschalten',
  lock: 'Abschließen',
  unlock: 'Aufschließen',
  view: 'Sehen',
  control: 'Schalten',
  configure: 'Einrichten',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/^set_/, '').replaceAll('_', ' ') + ' setzen';
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  bewohner: 'Bewohner',
  gast: 'Gast',
  ki: 'KI',
};

export function roleLabel(role: string | undefined): string {
  return ROLE_LABELS[role ?? ''] ?? role ?? '';
}
