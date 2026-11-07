import clsx from 'clsx';
import { motion } from 'motion/react';

import type { Device } from '@smarthome/api-client';
import { controls, formatValue, isOn, isTemperature, label, primaryAction, tileStatus, type Feature, type TileSize } from '@smarthome/core';

import { readoutIcon, Slider, Stepper, Switch, typeIcon, typeLabel, useDeviceCommand } from '../components/DeviceCard';
import { Icon } from '../components/Icon';
import { useLongPress } from './useLongPress';

/** The springy nudge when a tile switches (motion respects reduced motion via MotionConfig in HomePage). */
const nudge = {
  on: { scale: [1, 1.05, 1] },
  off: { scale: [1, 0.97, 1] },
};
const spring = { type: 'spring', stiffness: 420, damping: 18 } as const;

/**
 * A device as small (S, 1×1) or medium (M, 2×1) tile. Tap: the primary action (switch lights, plugs and switches,
 * otherwise the details); long press, right click or the context menu key: the details. M shows the main control
 * inline (switch and brightness, or the thermostat's setpoint).
 */
export function DeviceTile({ device, size, onDetails }: { device: Device; size: Exclude<TileSize, 'l'>; onDetails: () => void }) {
  const command = useDeviceCommand(device);
  const action = primaryAction(device);
  const c = controls(device.type, device.capabilities);
  const state = device.state ?? {};
  const on = c.power ? isOn(c.power, state) : false;
  const locked = c.lock ? isOn(c.lock, state) : false;
  const heating = /^heat/i.test(String(state['running_state'] ?? ''));
  const status = tileStatus(device);
  const canControl = (device.permissions ?? []).some((p) => p.action === 'control');

  const press = () => {
    if (action.kind === 'toggle') {
      if (!command.isPending) {
        command.send(action.command);
      }
    } else {
      onDetails();
    }
  };
  const handlers = useLongPress({ onPress: press, onLongPress: onDetails });
  const lockedTap = action.kind === 'toggle' ? command.lockedFor(action.command) : undefined;
  const hint =
    action.kind !== 'toggle'
      ? 'Tippen für Optionen'
      : lockedTap
        ? `${lockedTap}, lange drücken für Optionen`
        : `Tippen zum ${action.on ? 'Ausschalten' : 'Einschalten'}, lange drücken für Optionen`;
  const ariaLabel = [device.name, status.toLowerCase()].filter(Boolean).join(', ') + `. ${hint}`;

  // M: the main control next to / below the face
  const brightness = c.settings.find((f): f is Extract<Feature, { kind: 'numeric' }> => f.kind === 'numeric' && f.property === 'brightness');
  const setpoint = c.settings.find((f): f is Extract<Feature, { kind: 'numeric' }> => f.kind === 'numeric' && isTemperature(f));

  return (
    <motion.div
      className={clsx('tile', `tile-${size}`, on && 'tile-on', (heating || (c.lock && !locked)) && 'tile-attention')}
      initial={false}
      animate={on ? 'on' : 'off'}
      variants={nudge}
      transition={spring}
      aria-busy={command.isPending}
    >
      <button type="button" className="tile-main" aria-label={ariaLabel} {...handlers}>
        <span className={clsx('tile-icon', (on || heating) && 'tile-icon-active')}>
          <Icon name={typeIcon(device.type, locked)} size={size === 's' ? 26 : 22} />
        </span>
        <span className="tile-text">
          <span className="tile-name">{device.name}</span>
          {/* the M lock tile shows its state large below; up here just what it is */}
          <span className="tile-status">{size === 'm' && c.lock ? typeLabel(device.type) : status || typeLabel(device.type)}</span>
        </span>
      </button>
      <button type="button" className="tile-more" aria-label={`Optionen für ${device.name}`} onClick={onDetails}>
        <Icon name="more" size={16} />
      </button>
      {size === 'm' && (c.power || setpoint) && (
        <div className="tile-controls">
          {c.power && (
            <div className="tile-switch">
              <Switch
                checked={on}
                disabled={!canControl || command.isPending || lockedTap !== undefined}
                label={`${device.name} ${on ? 'ausschalten' : 'einschalten'}`}
                onChange={(next) => command.send({ [c.power!.property]: next ? c.power!.on : c.power!.off })}
              />
            </div>
          )}
          {brightness && (
            <Slider
              feature={brightness}
              value={typeof state[brightness.property] === 'number' ? (state[brightness.property] as number) : undefined}
              disabled={!canControl}
              onSend={command.send}
            />
          )}
          {!c.power && setpoint && (
            <Stepper
              feature={setpoint}
              value={typeof state[setpoint.property] === 'number' ? (state[setpoint.property] as number) : undefined}
              disabled={!canControl}
              onSend={command.send}
            />
          )}
        </div>
      )}
      {size === 'm' && c.lock && <LockControls device={device} send={command.send} pending={command.isPending} />}
      {size === 'm' && !c.power && !setpoint && !c.lock && c.readouts.length > 0 && (
        // nothing to control inline (locks, sensors): the readings instead of an empty half
        <dl className="tile-readouts">
          {c.readouts.slice(0, 3).map((f) => (
            <div key={f.property} title={label(f.property)}>
              <dt>
                <Icon name={readoutIcon(f.property)} size={13} label={label(f.property)} />
              </dt>
              <dd>{formatValue(f, state[f.property])}</dd>
            </div>
          ))}
        </dl>
      )}
      {command.dialog}
    </motion.div>
  );
}

/** M tile of a lock: the state large, battery and the like, and "Öffnen" / "Abschließen" (with the confirm dialog). */
function LockControls({ device, send, pending }: { device: Device; send: (body: Record<string, unknown>) => void; pending: boolean }) {
  const c = controls(device.type, device.capabilities);
  const state = device.state ?? {};
  const lock = c.lock!;
  const locked = isOn(lock, state);
  const permissions = device.permissions ?? [];
  const canControl = permissions.some((p) => p.action === 'control');
  const canUnlock = permissions.some((p) => p.action === 'unlock');
  const readings = c.readouts.filter((f) => f.property !== 'lock_state').slice(0, 2);
  return (
    <div className="tile-lock">
      <div className="tile-lock-state">
        <span className={clsx('tile-lock-big', locked ? 'tile-lock-locked' : 'tile-lock-open')}>
          <Icon name={locked ? 'lock' : 'unlock'} size={18} />
          {locked ? 'Abgeschlossen' : 'Offen'}
        </span>
        {readings.map((f) => (
          <span key={f.property} className="tile-lock-reading" title={label(f.property)}>
            <Icon name={readoutIcon(f.property)} size={13} label={label(f.property)} />
            {formatValue(f, state[f.property])}
          </span>
        ))}
      </div>
      {locked && canUnlock && (
        <button type="button" className="primary" disabled={pending} onClick={() => send({ [lock.property]: lock.off })}>
          <Icon name="unlock" size={16} />
          Öffnen
        </button>
      )}
      {!locked && canControl && (
        <button type="button" disabled={pending} onClick={() => send({ [lock.property]: lock.on })}>
          <Icon name="lock" size={16} />
          Abschließen
        </button>
      )}
    </div>
  );
}

/** The face of a tile without any action, for the edit mode. */
export function TilePreview({ device }: { device: Device }) {
  const c = controls(device.type, device.capabilities);
  const state = device.state ?? {};
  const on = c.power ? isOn(c.power, state) : false;
  const locked = c.lock ? isOn(c.lock, state) : false;
  return (
    <span className="tile-face">
      <span className={clsx('tile-icon', on && 'tile-icon-active')}>
        <Icon name={typeIcon(device.type, locked)} size={22} />
      </span>
      <span className="tile-text">
        <span className="tile-name">{device.name}</span>
        <span className="tile-status">{tileStatus(device) || typeLabel(device.type)}</span>
      </span>
    </span>
  );
}
