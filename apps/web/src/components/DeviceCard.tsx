import { useEffect, useRef, useState } from 'react';

/** How long a value the user just set is shown before the device's reported value takes over again. */
const DRAFT_MS = 2500;

import { ApiError, type Device } from '@smarthome/api-client';
import { controls, formatValue, isOn, isTemperature, label, type Feature } from '@smarthome/core';

import { useCommand } from '../api';
import { useToast } from './Toasts';

/** One device with the controls its capabilities and the caller's permissions allow. */
export function DeviceCard({ device }: { device: Device }) {
  const command = useCommand();
  const toast = useToast();
  const state = device.state ?? {};
  const c = controls(device.type, device.capabilities);
  const permissions = new Map((device.permissions ?? []).map((p) => [p.action, p]));
  const canControl = permissions.has('control');
  const unlock = permissions.get('unlock');

  const send = (body: Record<string, unknown>) => {
    if (device.id === undefined) {
      return;
    }
    command.mutate(
      { deviceId: device.id, command: body },
      {
        onSuccess: (result) => {
          if (result.status === 'confirmation_required') {
            toast('info', `${device.name}: wartet auf Freigabe`);
          }
        },
        onError: (error) => toast('error', error instanceof ApiError ? error.message : 'Befehl fehlgeschlagen'),
      },
    );
  };

  const on = c.power ? isOn(c.power, state) : false;
  const locked = c.lock ? isOn(c.lock, state) : false;

  return (
    <article className={`device ${on ? 'device-on' : ''}`} aria-busy={command.isPending}>
      <header className="device-head">
        <div>
          <h3>{device.name}</h3>
          <p className="device-meta">{typeLabel(device.type)}</p>
        </div>
        {c.power && (
          <Switch
            checked={on}
            disabled={!canControl || command.isPending}
            label={`${device.name} ${on ? 'ausschalten' : 'einschalten'}`}
            onChange={(next) => send({ [c.power!.property]: next ? c.power!.on : c.power!.off })}
          />
        )}
      </header>

      {c.lock && (
        <div className="lock">
          <span className={`badge ${locked ? 'badge-ok' : 'badge-warn'}`}>{locked ? 'Abgeschlossen' : 'Offen'}</span>
          <div className="row">
            {canControl && (
              <button type="button" disabled={locked || command.isPending} onClick={() => send({ [c.lock!.property]: c.lock!.on })}>
                Abschließen
              </button>
            )}
            {unlock && (
              <button type="button" className="primary" disabled={!locked || command.isPending} onClick={() => send({ [c.lock!.property]: c.lock!.off })}>
                {unlock.requiresConfirmation ? 'Öffnen anfragen' : 'Öffnen'}
              </button>
            )}
          </div>
        </div>
      )}

      {c.settings.map((feature) => (
        <Setting key={feature.property} feature={feature} value={state[feature.property]} disabled={!canControl} onSend={send} />
      ))}

      {c.readouts.length > 0 && (
        <dl className="readouts">
          {c.readouts.map((feature) => (
            <div key={feature.property}>
              <dt>{label(feature.property)}</dt>
              <dd>{formatValue(feature, state[feature.property])}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function Setting({
  feature,
  value,
  disabled,
  onSend,
}: {
  feature: Feature;
  value: unknown;
  disabled: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  if (feature.kind === 'numeric' && isTemperature(feature)) {
    return <Stepper feature={feature} value={typeof value === 'number' ? value : undefined} disabled={disabled} onSend={onSend} />;
  }
  if (feature.kind === 'numeric') {
    return <Slider feature={feature} value={typeof value === 'number' ? value : undefined} disabled={disabled} onSend={onSend} />;
  }
  if (feature.kind === 'enum') {
    return (
      <label className="setting">
        <span>{label(feature.property)}</span>
        <select value={String(value ?? '')} disabled={disabled} onChange={(e) => onSend({ [feature.property]: e.target.value })}>
          {feature.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (feature.kind === 'binary') {
    return (
      <div className="setting">
        <span>{label(feature.property)}</span>
        <Switch
          checked={value === feature.on}
          disabled={disabled}
          label={label(feature.property)}
          onChange={(next) => onSend({ [feature.property]: next ? feature.on : feature.off })}
        />
      </div>
    );
  }
  return null;
}

/**
 * A value the user is changing: shown instead of the device's value while they are at it and a moment after,
 * until the device reports the new state.
 */
function useDraft(value: number | undefined) {
  const [draft, setDraft] = useState<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (next: number) => {
    clearTimeout(timer.current);
    setDraft(next);
  };
  const settle = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDraft(undefined), DRAFT_MS);
  };
  return { shown: draft ?? value, draft, change, settle, timer };
}

/** Sends once the user lets go, not for every step. */
function Slider({
  feature,
  value,
  disabled,
  onSend,
}: {
  feature: Extract<Feature, { kind: 'numeric' }>;
  value: number | undefined;
  disabled: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const min = feature.min ?? 0;
  const max = feature.max ?? 100;
  const { shown, draft, change, settle } = useDraft(value);
  const local = shown ?? min;
  const commit = () => {
    if (draft !== undefined && draft !== value) {
      onSend({ [feature.property]: draft });
    }
    settle();
  };
  return (
    <label className="setting">
      <span>
        {label(feature.property)} <output>{feature.property === 'brightness' ? `${Math.round(((local - min) / (max - min)) * 100)} %` : formatValue(feature, local)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={feature.step ?? 1}
        value={local}
        disabled={disabled}
        onChange={(e) => change(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
      />
    </label>
  );
}

/** +/- in half degrees; sends after a short pause, so several clicks become one command. */
function Stepper({
  feature,
  value,
  disabled,
  onSend,
}: {
  feature: Extract<Feature, { kind: 'numeric' }>;
  value: number | undefined;
  disabled: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const { shown: local, change: setDraft, settle } = useDraft(value);
  const send = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(send.current), []);
  const step = feature.step ?? 0.5;
  const change = (delta: number) => {
    const base = local ?? feature.min ?? 20;
    const next = Math.min(feature.max ?? 35, Math.max(feature.min ?? 0, Math.round((base + delta) / step) * step));
    setDraft(next);
    clearTimeout(send.current);
    send.current = setTimeout(() => {
      onSend({ [feature.property]: next });
      settle();
    }, 600);
  };
  return (
    <div className="setting">
      <span>{label(feature.property)}</span>
      <div className="stepper">
        <button type="button" aria-label="Kälter" disabled={disabled} onClick={() => change(-step)}>
          −
        </button>
        <output>{formatValue(feature, local)}</output>
        <button type="button" aria-label="Wärmer" disabled={disabled} onClick={() => change(step)}>
          +
        </button>
      </div>
    </div>
  );
}

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="switch-knob" />
    </button>
  );
}

const TYPES: Record<string, string> = {
  light: 'Licht',
  switch: 'Schalter',
  thermostat: 'Thermostat',
  lock: 'Schloss',
  sensor: 'Sensor',
};

function typeLabel(type: string | undefined): string {
  return TYPES[type ?? ''] ?? type ?? '';
}
