import { useState, type FormEvent } from 'react';

import type { Room } from '@smarthome/api-client';
import { sortRooms } from '@smarthome/core';

import { useRooms } from '../api';
import { useToast } from '../components/Toasts';
import { useCreateRoom, useDeleteRoom, useReorderRooms, useUpdateRoom } from './adminApi';
import { Panel, errorText } from './ui';

/** Create, rename, sort (drag and drop or arrows) and delete rooms. */
export function RoomsAdmin() {
  const rooms = useRooms();
  const create = useCreateRoom();
  const reorder = useReorderRooms();
  const toast = useToast();
  const [name, setName] = useState('');
  const [dragged, setDragged] = useState<number | null>(null);
  const list = sortRooms(rooms.data ?? []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name: name.trim() },
      { onSuccess: () => setName(''), onError: (e) => toast('error', errorText(e)) },
    );
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) {
      return;
    }
    const ids = list.map((r) => r.id!);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    reorder.mutate(ids, { onError: (e) => toast('error', errorText(e)) });
  };

  return (
    <div className="stack">
      <Panel title="Neuer Raum">
        <form className="item-form" onSubmit={submit}>
          <input aria-label="Name des Raums" placeholder="z. B. Küche" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required />
          <button type="submit" className="primary" disabled={create.isPending || !name.trim()}>
            Anlegen
          </button>
        </form>
      </Panel>
      <Panel title="Räume">
        {list.length === 0 && <p className="muted">Noch keine Räume.</p>}
        <p className="muted small">Reihenfolge per Ziehen oder mit den Pfeilen ändern; so erscheinen die Räume auf der Startseite.</p>
        <ol className="list sortable">
          {list.map((room, index) => (
            <li
              key={room.id}
              className={`item ${dragged === index ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => {
                // Firefox only starts dragging with some data set
                e.dataTransfer.setData('text/plain', String(room.id));
                e.dataTransfer.effectAllowed = 'move';
                setDragged(index);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = list.findIndex((r) => String(r.id) === e.dataTransfer.getData('text/plain'));
                if (from >= 0) {
                  move(from, index);
                }
                setDragged(null);
              }}
              onDragEnd={() => setDragged(null)}
            >
              <span className="handle" aria-hidden>
                ⋮⋮
              </span>
              <RoomRow room={room} />
              <div className="row">
                <button type="button" className="ghost" aria-label={`${room.name} nach oben`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                  ↑
                </button>
                <button type="button" className="ghost" aria-label={`${room.name} nach unten`} disabled={index === list.length - 1} onClick={() => move(index, index + 1)}>
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function RoomRow({ room }: { room: Room }) {
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(room.name ?? '');

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      { id: room.id!, body: { name: name.trim() } },
      { onSuccess: () => setEditing(false), onError: (e) => toast('error', errorText(e)) },
    );
  };
  const removeRoom = () => {
    if (window.confirm(`Raum ${room.name} löschen?`)) {
      remove.mutate(room.id!, { onError: (e) => toast('error', errorText(e)) });
    }
  };

  if (editing) {
    return (
      <form className="item-form grow" onSubmit={save}>
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required autoFocus />
        <button type="submit" className="primary" disabled={update.isPending}>
          Speichern
        </button>
        <button type="button" className="ghost" onClick={() => setEditing(false)}>
          Abbrechen
        </button>
      </form>
    );
  }
  return (
    <div className="item-main grow">
      <strong>{room.name}</strong>
      <span className="muted">
        {room.deviceCount} {room.deviceCount === 1 ? 'Gerät' : 'Geräte'} ·{' '}
        <button type="button" className="link" onClick={() => setEditing(true)}>
          umbenennen
        </button>{' '}
        ·{' '}
        <button type="button" className="link danger-link" onClick={removeRoom}>
          löschen
        </button>
      </span>
    </div>
  );
}
