import { useState, type FormEvent } from 'react';

import type { Device, Room } from '@smarthome/api-client';
import { actionLabel, PAIRING_SECONDS } from '@smarthome/core';

import { useDevices, useRooms } from '../api';
import { typeIcon, typeLabel } from '../components/DeviceCard';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toasts';
import {
  useAddDevice,
  useDiscovered,
  usePairing,
  useRemoveDevice,
  useStartPairing,
  useStopPairing,
  useUpdateDevice,
  type Discovered,
} from './adminApi';
import { EmptyState, FormDialog, MenuItem, Panel, RowMenu, SkeletonRows, StatusBadge, errorText, lockableActions, useSecondsLeft } from './ui';

/** Pairing, newly found devices, and the devices already added. */
export function DevicesAdmin() {
  const rooms = useRooms();
  const devices = useDevices();
  return (
    <div className="stack">
      <PairingPanel />
      <DiscoveredPanel rooms={rooms.data ?? []} />
      <Panel title="Geräte">
        {devices.isPending && <SkeletonRows />}
        {devices.data?.length === 0 && <EmptyState icon="device">Noch keine Geräte übernommen.</EmptyState>}
        {(devices.data?.length ?? 0) > 0 && (
          <div className="table-wrap">
            <table className="table adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Raum</th>
                  <th>Typ</th>
                  <th>Gesperrt</th>
                  <th>
                    <span className="adm-visually-hidden">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...(devices.data ?? [])]
                  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
                  .map((d) => (
                    <DeviceRow key={d.id} device={d} rooms={rooms.data ?? []} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function PairingPanel() {
  const pairing = usePairing();
  const start = useStartPairing();
  const stop = useStopPairing();
  const toast = useToast();
  const left = useSecondsLeft(pairing.data?.active ? pairing.data.endsAt : undefined);
  const active = Boolean(pairing.data?.active) && left > 0;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;

  return (
    <Panel
      className={active ? 'adm-pairing adm-pairing-active' : 'adm-pairing'}
      title="Anlernmodus"
      actions={
        active ? (
          <button type="button" disabled={stop.isPending} onClick={() => stop.mutate(undefined, { onError: (e) => toast('error', errorText(e)) })}>
            Beenden
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={start.isPending}
            onClick={() => start.mutate(PAIRING_SECONDS, { onError: (e) => toast('error', errorText(e, 'Zigbee2MQTT antwortet nicht')) })}
          >
            <Icon name="live" size={16} />
            Anlernen starten
          </button>
        )
      }
    >
      {active ? (
        <div className="adm-pairing-body">
          {/* Ring that empties as the time runs out */}
          <div className="adm-countdown" style={{ ['--progress' as string]: Math.min(1, left / PAIRING_SECONDS) }}>
            <span className="adm-countdown-time" role="timer" aria-label={`noch ${minutes} Minuten ${seconds} Sekunden`}>
              {minutes}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
          <div className="adm-pairing-text">
            <strong>
              <span className="pulse" aria-hidden />
              Neue Zigbee-Geräte können sich jetzt verbinden
            </strong>
            <p className="muted">
              Gerät in den Kopplungsmodus versetzen (meist Knopf lange drücken oder mehrmals ein- und ausschalten). Es erscheint unten, sobald Zigbee2MQTT es erkannt
              hat.
            </p>
          </div>
        </div>
      ) : (
        <div className="adm-pairing-body">
          <span className="adm-pairing-icon" aria-hidden>
            <Icon name={pairing.data?.known === false ? 'offline' : 'live'} size={22} />
          </span>
          <p className="muted">
            {pairing.data?.known === false
              ? 'Zigbee2MQTT hat sich noch nicht gemeldet.'
              : 'Aus. Beim Start dürfen sich für gut vier Minuten neue Geräte verbinden.'}
          </p>
        </div>
      )}
    </Panel>
  );
}

function DiscoveredPanel({ rooms }: { rooms: Room[] }) {
  const discovered = useDiscovered();
  if (!discovered.data?.length) {
    return null;
  }
  return (
    <Panel className="adm-highlight" title={`Gefunden (${discovered.data.length})`}>
      <div className="list adm-list">
        {discovered.data.map((d) => (
          <AdoptRow key={`${d.adapter}/${d.externalId}`} device={d} rooms={rooms} />
        ))}
      </div>
    </Panel>
  );
}

function AdoptRow({ device, rooms }: { device: Discovered; rooms: Room[] }) {
  const add = useAddDevice();
  const toast = useToast();
  const [name, setName] = useState(device.suggestedName ?? '');
  const [roomId, setRoomId] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(
      { adapter: device.adapter ?? '', externalId: device.externalId ?? '', name: name.trim(), ...(roomId ? { roomId: Number(roomId) } : {}) },
      { onSuccess: () => toast('success', `${name} übernommen`), onError: (e) => toast('error', errorText(e)) },
    );
  };
  return (
    <form className="item adm-item" onSubmit={submit}>
      <span className="adm-item-icon" aria-hidden>
        <Icon name={typeIcon(device.type)} size={18} />
      </span>
      <div className="item-main">
        <strong>{device.suggestedName}</strong>
        <span className="muted">
          {[device.vendor, device.model, device.type].filter(Boolean).join(' · ')} · {device.externalId}
        </span>
      </div>
      <div className="item-form">
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <RoomSelect rooms={rooms} value={roomId} onChange={setRoomId} />
        <button type="submit" className="primary" disabled={add.isPending || !name.trim()}>
          Übernehmen
        </button>
      </div>
    </form>
  );
}

/** One added device as table row; editing happens in a dialog. */
function DeviceRow({ device, rooms }: { device: Device; rooms: Room[] }) {
  const update = useUpdateDevice();
  const remove = useRemoveDevice();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(device.name ?? '');
  const [roomId, setRoomId] = useState(device.roomId ? String(device.roomId) : '');
  const [locked, setLocked] = useState<string[]>(device.lockedActions ?? []);
  const room = rooms.find((r) => r.id === device.roomId);

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      { id: device.id!, body: { name: name.trim(), roomId: roomId ? Number(roomId) : (null as unknown as number), lockedActions: locked } },
      {
        onSuccess: () => {
          toast('success', 'Gespeichert');
          setOpen(false);
        },
        onError: (e) => toast('error', errorText(e)),
      },
    );
  };
  const removeDevice = () => {
    if (window.confirm(`${device.name} entfernen? Es taucht dann wieder unter „Gefunden“ auf.`)) {
      remove.mutate(device.id!, { onError: (e) => toast('error', errorText(e)) });
    }
  };

  return (
    <tr>
      <td>
        <span className="adm-name">
          <span className="adm-item-icon" aria-hidden>
            <Icon name={typeIcon(device.type)} size={16} />
          </span>
          <strong>{device.name}</strong>
        </span>
      </td>
      <td className={room ? undefined : 'muted'}>{room?.name ?? 'Ohne Raum'}</td>
      <td className="muted">{typeLabel(device.type)}</td>
      <td>
        {(device.lockedActions?.length ?? 0) > 0 ? (
          <span className="adm-badges">
            {device.lockedActions!.map((a) => (
              <StatusBadge key={a} tone="warn" icon="lock">
                {actionLabel(a)}
              </StatusBadge>
            ))}
          </span>
        ) : (
          <span className="muted">–</span>
        )}
      </td>
      <td className="adm-cell-end">
        <RowMenu label={`Aktionen für ${device.name}`}>
          <MenuItem icon="edit" onSelect={() => setOpen(true)}>
            Bearbeiten
          </MenuItem>
          <MenuItem icon="delete" danger disabled={remove.isPending} onSelect={removeDevice}>
            Entfernen
          </MenuItem>
        </RowMenu>
        <FormDialog open={open} onOpenChange={setOpen} title={`${device.name} bearbeiten`}>
          <form className="adm-form" onSubmit={save}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Raum
              <RoomSelect rooms={rooms} value={roomId} onChange={setRoomId} />
            </label>
            <fieldset>
              <legend>Gesperrte Aktionen (gelten für alle, auch Admins und die KI)</legend>
              <div className="chips">
                {lockableActions(device).map((action) => (
                  <label key={action} className="chip">
                    <input
                      type="checkbox"
                      checked={locked.includes(action)}
                      onChange={(e) => setLocked(e.target.checked ? [...locked, action] : locked.filter((a) => a !== action))}
                    />
                    {actionLabel(action)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="adm-form-actions">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button type="submit" className="primary" disabled={update.isPending}>
                Speichern
              </button>
            </div>
          </form>
        </FormDialog>
      </td>
    </tr>
  );
}

export function RoomSelect({ rooms, value, onChange }: { rooms: Room[]; value: string; onChange: (value: string) => void }) {
  return (
    <select aria-label="Raum" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Ohne Raum</option>
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
