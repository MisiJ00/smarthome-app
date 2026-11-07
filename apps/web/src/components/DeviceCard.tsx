import { useEffect, useRef, useState, type MouseEvent } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import clsx from 'clsx';

/** How long a value the user just set is shown before the device's reported value takes over again. */
const DRAFT_MS = 2500;

import { ApiError, type CommandResponse, type Device } from '@smarthome/api-client';
import { actionLabel, colorTempHint, commandIntent, controls, lockedReason, formatValue, isColorTemp, isOn, isTemperature, label, miredToKelvin, optionLabel, type Feature } from '@smarthome/core';
import type { IconName } from '@smarthome/theme';

import { useCommand, useDecide } from '../api';
import { ConfirmDialog, type ConfirmState } from '../dashboard/ConfirmDialog';
import { Icon } from './Icon';
import { useToast } from './Toasts';
import '../devices.css';

/**
 * Sends commands to one device (card and dashboard tiles). A locked action gives a short notice ("Ausschalten ist
 * gesperrt") instead of a refused request; one that needs an approval first asks "Wirklich öffnen?" and then tells to
 * confirm in the app (render `dialog`); everything else is sent at once, with the backend's message on errors.
 */
export function useDeviceCommand(device: Device) {
  const command = useCommand();
  const decide = useDecide();
  const toast = useToast();
  const [confirm, setConfirm] = useState<(ConfirmState & { body: Record<string, unknown> }) | null>(null);

  const post = (body: Record<string, unknown>, onDone?: (result: CommandResponse) => void, onFailed?: () => void) => {
    if (device.id === undefined) {
      return;
    }
    command.mutate(
      { deviceId: device.id, command: body },
      {
        onSuccess: (result) => {
          if (onDone) {
            onDone(result);
          } else if (result.status === 'confirmation_required') {
            toast('info', `${device.name}: wartet auf Freigabe`);
          }
        },
        onError: (error) => {
          onFailed?.();
          toast('error', error instanceof ApiError ? error.message : 'Befehl fehlgeschlagen');
        },
      },
    );
  };

  const send = (body: Record<string, unknown>) => {
    const intent = commandIntent(device, body);
    if (intent.locked) {
      toast('info', intent.locked);
      return;
    }
    if (intent.requiresConfirmation) {
      setConfirm({ phase: 'ask', deviceName: device.name ?? 'Gerät', intent, body });
      return;
    }
    post(body);
  };

  const confirmed = () => {
    if (!confirm) {
      return;
    }
    setConfirm({ ...confirm, phase: 'sending' });
    post(
      confirm.body,
      (result) => {
        if (result.status === 'confirmation_required') {
          setConfirm({
            ...confirm,
            phase: 'inApp',
            ...(result.confirmationId != null ? { confirmationId: result.confirmationId } : {}),
            ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
          });
        } else {
          setConfirm(null);
          toast('success', confirm.intent.done);
        }
      },
      () => setConfirm(null),
    );
  };

  const withdraw = () => {
    if (confirm?.phase === 'inApp' && confirm.confirmationId !== undefined) {
      decide.mutate(
        { id: confirm.confirmationId, approve: false },
        { onSuccess: () => toast('info', 'Anfrage zurückgezogen'), onError: (error) => toast('error', error instanceof ApiError ? error.message : 'Das hat nicht geklappt') },
      );
    }
    setConfirm(null);
  };

  const dialog = <ConfirmDialog state={confirm} onConfirm={confirmed} onWithdraw={withdraw} onClose={() => setConfirm(null)} />;
  return {
    send,
    isPending: command.isPending,
    /** Why this command is locked ("Ausschalten ist gesperrt"), for disabled controls. */
    lockedFor: (body: Record<string, unknown>) => lockedReason(device, body),
    /** The "Wirklich …?" dialog; render it next to the controls. */
    dialog,
  };
}

/**
 * One device with the controls its capabilities and the caller's permissions allow. `variant="sheet"`: the content
 * of the detail sheet (no card of its own).
 */
export function DeviceCard({ device, variant = 'card' }: { device: Device; variant?: 'card' | 'sheet' }) {
  const command = useDeviceCommand(device);
  const send = command.send;
  const state = device.state ?? {};
  const c = controls(device.type, device.capabilities);
  const permissions = new Map((device.permissions ?? []).map((p) => [p.action, p]));
  const canControl = permissions.has('control');
  const unlock = permissions.get('unlock');

  const on = c.power ? isOn(c.power, state) : false;
  const locked = c.lock ? isOn(c.lock, state) : false;
  const heating = /^heat/i.test(String(state['running_state'] ?? ''));
  // Greyed out when its next step is locked by an admin; the reason is shown below the head
  const nextLocked = c.power ? command.lockedFor({ [c.power.property]: on ? c.power.off : c.power.on }) : undefined;
  // In the sheet the head is just a title (a tap there must not switch); on the card it switches like the switch
  const canSwitch = variant === 'card' && Boolean(c.power) && canControl && !command.isPending && nextLocked === undefined;
  const toggle = (next: boolean) => send({ [c.power!.property]: next ? c.power!.on : c.power!.off });
  const lockedActions = device.lockedActions ?? [];
  const lockedText = `Gesperrt: ${lockedActions.map(actionLabel).join(', ')}`;

  // The whole head switches, like the switch itself; clicks on the switch are handled by the switch.
  const onHeadClick = (event: MouseEvent) => {
    if (canSwitch && !(event.target as Element).closest('button')) {
      toggle(!on);
    }
  };

  return (
    <article className={clsx('device', on && 'device-on', variant === 'sheet' && 'device-sheet')} aria-busy={command.isPending}>
      <header className={clsx('device-head', canSwitch && 'device-head-switchable')} onClick={onHeadClick}>
        <span className={clsx('device-icon', (on || heating) && 'device-icon-active', c.lock && locked && 'device-icon-ok')}>
          <Icon name={typeIcon(device.type, locked)} size={22} />
        </span>
        <div className="device-title">
          <h3>{device.name}</h3>
          <p className="device-meta">
            {typeLabel(device.type)}
            {c.power && <span className="device-state"> · {on ? 'An' : 'Aus'}</span>}
          </p>
        </div>
        {lockedActions.length > 0 && (
          <span className="badge device-locked" role="img" aria-label={lockedText} title={lockedText}>
            <Icon name="lock" size={13} />
          </span>
        )}
        {c.power && (
          <Switch
            checked={on}
            disabled={!canControl || command.isPending || nextLocked !== undefined}
            label={`${device.name} ${on ? 'ausschalten' : 'einschalten'}`}
            onChange={toggle}
          />
        )}
      </header>
      {nextLocked && (
        <p className="device-locked-note">
          <Icon name="lock" size={14} />
          {nextLocked}
        </p>
      )}
      {command.dialog}

      {c.lock && (
        <div className="lock">
          <span className={clsx('badge', locked ? 'badge-ok' : 'badge-warn')}>
            <Icon name={locked ? 'lock' : 'unlock'} size={14} />
            {locked ? 'Abgeschlossen' : 'Offen'}
          </span>
          <div className="lock-actions">
            {canControl && (
              <button type="button" disabled={locked || command.isPending} onClick={() => send({ [c.lock!.property]: c.lock!.on })}>
                <Icon name="lock" size={16} />
                Abschließen
              </button>
            )}
            {unlock && (
              <button type="button" className="primary" disabled={!locked || command.isPending} onClick={() => send({ [c.lock!.property]: c.lock!.off })}>
                <Icon name={unlock.requiresConfirmation ? 'approval' : 'unlock'} size={16} />
                Öffnen
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
            <div key={feature.property} className="readout">
              <dt>
                <Icon name={readoutIcon(feature.property)} size={14} />
                {label(feature.property)}
              </dt>
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
    return <Choice feature={feature} value={value} disabled={disabled} onSend={onSend} />;
  }
  if (feature.kind === 'binary') {
    return (
      <div className="setting setting-inline">
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

/** More than this many values do not fit side by side; they get a select instead of a segmented control. */
const MAX_SEGMENTS = 4;

/** A mode and the like: a segmented control for few values, a select for many. */
function Choice({
  feature,
  value,
  disabled,
  onSend,
}: {
  feature: Extract<Feature, { kind: 'enum' }>;
  value: unknown;
  disabled: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const current = String(value ?? '');
  if (feature.values.length > MAX_SEGMENTS) {
    return (
      <label className="setting">
        <span>{label(feature.property)}</span>
        <select value={current} disabled={disabled} onChange={(e) => onSend({ [feature.property]: e.target.value })}>
          {feature.values.map((v) => (
            <option key={v} value={v}>
              {optionLabel(feature.property, v)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="setting">
      <span>{label(feature.property)}</span>
      <div className="segmented" role="group" aria-label={label(feature.property)}>
        {feature.values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === current}
            className={clsx('segment', v === current && 'segment-active')}
            disabled={disabled}
            onClick={() => v !== current && onSend({ [feature.property]: v })}
          >
            {modeIcon(v) && <Icon name={modeIcon(v)!} size={15} />}
            {optionLabel(feature.property, v)}
          </button>
        ))}
      </div>
    </div>
  );
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
export function Slider({
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
  const { shown, change, settle } = useDraft(value);
  const local = shown ?? min;
  const colorTemp = isColorTemp(feature);
  const commit = (next: number) => {
    if (next !== value) {
      onSend({ [feature.property]: next });
    }
    settle();
  };
  // Colour temperature without a reported value shows "–" (the slider still needs a position)
  const kelvin = colorTemp && shown !== undefined && shown > 0 ? miredToKelvin(shown) : undefined;
  const shownText =
    feature.property === 'brightness'
      ? `${max > min ? Math.round(((local - min) / (max - min)) * 100) : 100} %`
      : formatValue(feature, colorTemp ? shown : local);
  return (
    <div className="setting">
      <span>
        {label(feature.property)}{' '}
        <output>
          {shownText}
          {kelvin !== undefined && <span className="muted"> · {colorTempHint(kelvin)}</span>}
        </output>
      </span>
      <SliderPrimitive.Root
        className={clsx('slider', colorTemp && 'slider-color-temp')}
        min={min}
        max={max}
        step={feature.step ?? 1}
        value={[local]}
        disabled={disabled}
        // More mired is warmer: warm on the left, cold on the right, as people expect
        inverted={colorTemp}
        onValueChange={([next]) => next !== undefined && change(next)}
        onValueCommit={([next]) => next !== undefined && commit(next)}
      >
        <SliderPrimitive.Track className="slider-track">
          <SliderPrimitive.Range className="slider-range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="slider-thumb" aria-label={label(feature.property)} />
      </SliderPrimitive.Root>
      {colorTemp && (
        <span className="slider-ends" aria-hidden>
          <span>warm</span>
          <span>kalt</span>
        </span>
      )}
    </div>
  );
}

/** +/- in half degrees; sends after a short pause, so several clicks become one command. */
export function Stepper({
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
    <div className="setting setpoint">
      <span>{label(feature.property)}</span>
      <div className="stepper">
        <button type="button" className="round" aria-label="Kälter" disabled={disabled} onClick={() => change(-step)}>
          <Icon name="minus" size={20} />
        </button>
        <output className="setpoint-value">{formatValue(feature, local)}</output>
        <button type="button" className="round" aria-label="Wärmer" disabled={disabled} onClick={() => change(step)}>
          <Icon name="plus" size={20} />
        </button>
      </div>
    </div>
  );
}

export function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <SwitchPrimitive.Root className="toggle" checked={checked} disabled={disabled} aria-label={label} onCheckedChange={onChange}>
      <SwitchPrimitive.Thumb className="toggle-thumb" />
    </SwitchPrimitive.Root>
  );
}

const TYPES: Record<string, string> = {
  light: 'Licht',
  switch: 'Schalter',
  thermostat: 'Thermostat',
  lock: 'Schloss',
  sensor: 'Sensor',
};

export function typeLabel(type: string | undefined): string {
  return TYPES[type ?? ''] ?? type ?? '';
}

const TYPE_ICONS: Record<string, IconName> = {
  light: 'light',
  switch: 'plug',
  plug: 'plug',
  thermostat: 'climate',
  sensor: 'sensor',
  cover: 'cover',
};

export function typeIcon(type: string | undefined, locked = true): IconName {
  if (type === 'lock') {
    return locked ? 'lock' : 'unlock';
  }
  return TYPE_ICONS[type ?? ''] ?? 'device';
}

const READOUT_ICONS: Record<string, IconName> = {
  temperature: 'temperature',
  local_temperature: 'temperature',
  humidity: 'humidity',
  battery: 'battery',
  power: 'power',
  energy: 'energy',
  voltage: 'energy',
  current: 'energy',
  running_state: 'heat',
  lock_state: 'lock',
  occupancy: 'motion',
  contact: 'contact',
};

export function readoutIcon(property: string): IconName {
  return READOUT_ICONS[property] ?? 'info';
}

const MODE_ICONS: Record<string, IconName> = { off: 'power', auto: 'auto', heat: 'heat', cool: 'cool', fan_only: 'fan' };

function modeIcon(value: string): IconName | undefined {
  return MODE_ICONS[value.toLowerCase()];
}
