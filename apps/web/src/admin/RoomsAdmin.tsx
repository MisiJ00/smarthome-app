import { useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

import type { Room } from '@smarthome/api-client';
import { sortRooms } from '@smarthome/core';

import { useRooms } from '../api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toasts';
import { useCreateRoom, useDeleteRoom, useReorderRooms, useUpdateRoom } from './adminApi';
import { EmptyState, MenuItem, Panel, RowMenu, StatusBadge, errorText } from './ui';

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
            <Icon name="add" size={16} />
            Anlegen
          </button>
        </form>
      </Panel>
      <Panel title="Räume">
        {list.length === 0 && <EmptyState icon="room">Noch keine Räume.</EmptyState>}
        <p className="muted small">Reihenfolge per Ziehen oder mit den Pfeilen ändern; so erscheinen die Räume auf der Startseite.</p>
        <ol className="list sortable adm-list">
          {list.map((room, index) => (
            <li
              key={room.id}
              className={`item adm-item ${dragged === index ? 'dragging' : ''}`}
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
              <span className="handle adm-handle" aria-hidden>
                <GripVertical size={18} />
              </span>
              <RoomRow room={room}>
                <div className="adm-arrows">
                  <button
                    type="button"
                    className="ghost icon-button adm-icon-button"
                    aria-label={`${room.name} nach oben`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="ghost icon-button adm-icon-button"
                    aria-label={`${room.name} nach unten`}
                    disabled={index === list.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown size={18} aria-hidden />
                  </button>
                </div>
              </RoomRow>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

/** Name and device count with rename/delete in the row menu; `children` are the move buttons, hidden while renaming. */
function RoomRow({ room, children }: { room: Room; children: ReactNode }) {
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
    <>
      <div className="item-main grow">
        <strong>{room.name}</strong>
      </div>
      <StatusBadge>
        {room.deviceCount} {room.deviceCount === 1 ? 'Gerät' : 'Geräte'}
      </StatusBadge>
      {children}
      <RowMenu label={`Aktionen für ${room.name}`}>
        <MenuItem icon="edit" onSelect={() => setEditing(true)}>
          Umbenennen
        </MenuItem>
        <MenuItem icon="delete" danger disabled={remove.isPending} onSelect={removeRoom}>
          Löschen
        </MenuItem>
      </RowMenu>
    </>
  );
}
