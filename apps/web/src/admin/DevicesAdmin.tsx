import { useState, type FormEvent } from 'react';

import type { Device, Room } from '@smarthome/api-client';

import { useDevices, useRooms } from '../api';
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
import { Panel, actionLabel, errorText, lockableActions, useSecondsLeft } from './ui';

/** Pairing, newly found devices, and the devices already added. */
export function DevicesAdmin() {
  const rooms = useRooms();
  const devices = useDevices();
  return (
    <div className="stack">
      <PairingPanel />
      <DiscoveredPanel rooms={rooms.data ?? []} />
      <Panel title="Geräte">
        {devices.isPending && <p className="muted">Lade …</p>}
        {devices.data?.length === 0 && <p className="muted">Noch keine Geräte übernommen.</p>}
        <div className="list">
          {[...(devices.data ?? [])]
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
            .map((d) => (
              <DeviceRow key={d.id} device={d} rooms={rooms.data ?? []} />
            ))}
        </div>
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

  return (
    <Panel
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
            onClick={() => start.mutate(254, { onError: (e) => toast('error', errorText(e, 'Zigbee2MQTT antwortet nicht')) })}
          >
            Anlernen starten
          </button>
        )
      }
    >
      {active ? (
        <div className="pairing-active">
          <span className="pulse" aria-hidden />
          <div>
            <strong>
              Neue Zigbee-Geräte können sich jetzt verbinden · noch {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </strong>
            <p className="muted">Gerät in den Kopplungsmodus versetzen (meist Knopf lange drücken oder mehrmals ein- und ausschalten). Es erscheint unten, sobald Zigbee2MQTT es erkannt hat.</p>
          </div>
        </div>
      ) : (
        <p className="muted">
          {pairing.data?.known === false
            ? 'Zigbee2MQTT hat sich noch nicht gemeldet.'
            : 'Aus. Beim Start dürfen sich für gut vier Minuten neue Geräte verbinden.'}
        </p>
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
    <Panel title={`Gefunden (${discovered.data.length})`}>
      <div className="list">
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
    <form className="item" onSubmit={submit}>
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
    <div className="item">
      <div className="item-main">
        <strong>{device.name}</strong>
        <span className="muted">
          {room?.name ?? 'Ohne Raum'} · {device.type}
          {(device.lockedActions?.length ?? 0) > 0 && ` · gesperrt: ${device.lockedActions!.map(actionLabel).join(', ')}`}
        </span>
      </div>
      <button type="button" className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Schließen' : 'Bearbeiten'}
      </button>
      {open && (
        <form className="item-edit" onSubmit={save}>
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
          <div className="row">
            <button type="submit" className="primary" disabled={update.isPending}>
              Speichern
            </button>
            <button type="button" className="danger" onClick={removeDevice} disabled={remove.isPending}>
              Entfernen
            </button>
          </div>
        </form>
      )}
    </div>
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
