import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
// not in the theme's icon names (yet), so straight from Lucide
import { Eye, EyeOff } from 'lucide-react';

import type { Device, Room } from '@smarthome/api-client';
import {
  arrangeDevices,
  deviceKey,
  hiddenDevices,
  moveDevice,
  setTileSize,
  tileSize,
  toggleHidden,
  withFullOrder,
  type DashboardLayout,
  type TileSize,
} from '@smarthome/core';

import { TilePreview } from './DeviceTile';

const SIZE_NAMES: Record<TileSize, string> = { s: 'Klein', m: 'Mittel', l: 'Groß' };

/**
 * The dashboard while editing: tiles wiggle and can be dragged (pointer or keyboard: focus the tile, Space, arrows,
 * Space) within their group; per tile the size S/M/L and hiding. Hidden devices are listed below.
 */
export function EditBoard({
  devices,
  rooms,
  layout,
  onChange,
}: {
  devices: Device[];
  rooms: Room[];
  layout: DashboardLayout;
  onChange: (layout: DashboardLayout) => void;
}) {
  const groups = arrangeDevices(devices, layout, rooms);
  const hidden = hiddenDevices(devices, layout, rooms);

  /** Moves within a group; a device that arrived while editing (not in the order yet) first gets its place. */
  const move = (id: string, overId: string) => {
    const full = layout.order.includes(id) && layout.order.includes(overId) ? layout : withFullOrder(layout, devices, rooms);
    onChange(moveDevice(full, id, full.order.indexOf(overId)));
  };

  return (
    <>
      {groups.map((group) => (
        <section key={group.room?.id ?? 'none'} className="room">
          {layout.grouping === 'rooms' && (
            <h2>
              {group.room?.name ?? 'Ohne Raum'}
              <span className="muted">{group.devices.length}</span>
            </h2>
          )}
          {/* One drag area per group: a tile cannot land in another room, and positions count within the group */}
          <SortableGroup devices={group.devices} layout={layout} onMove={move} onChange={onChange} />
        </section>
      ))}
      {hidden.length > 0 && (
        <section className="room dash-hidden">
          <h2>
            Ausgeblendet
            <span className="muted">{hidden.length}</span>
          </h2>
          <div className="dash-grid">
            {hidden.map((device) => (
              <div key={device.id} className="tile tile-s tile-edit tile-hidden">
                <TilePreview device={device} />
                <div className="tile-edit-controls">
                  <button
                    type="button"
                    className="ghost icon-button dash-small-button"
                    aria-label={`${device.name} wieder anzeigen`}
                    onClick={() => onChange(toggleHidden(layout, deviceKey(device)))}
                  >
                    <Eye size={16} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function SortableGroup({
  devices,
  layout,
  onMove,
  onChange,
}: {
  devices: Device[];
  layout: DashboardLayout;
  onMove: (id: string, overId: string) => void;
  onChange: (layout: DashboardLayout) => void;
}) {
  const sensors = useSensors(
    // a few px of movement first, so the size buttons stay clickable
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = devices.map(deviceKey);
  const nameOf = (id: UniqueIdentifier) => devices.find((d) => deviceKey(d) === String(id))?.name ?? 'Gerät';
  const position = (id: UniqueIdentifier) => `${ids.indexOf(String(id)) + 1} von ${ids.length}`;

  // Read out by screen readers while dragging, in German; positions within this group
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${nameOf(active.id)} aufgenommen, Position ${position(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} ist jetzt an Position ${position(over.id)}.` : `${nameOf(active.id)} ist außerhalb.`),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} abgelegt an Position ${position(over.id)}.` : `${nameOf(active.id)} bleibt, wo es war.`),
    onDragCancel: ({ active }) => `Verschieben abgebrochen, ${nameOf(active.id)} bleibt, wo es war.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id && ids.includes(String(over.id))) {
      onMove(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Zum Verschieben Leertaste drücken, mit den Pfeiltasten bewegen, mit Leertaste ablegen, mit Escape abbrechen.',
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="dash-grid">
          {devices.map((device) => (
            <SortableTile key={device.id} device={device} layout={layout} onChange={onChange} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({ device, layout, onChange }: { device: Device; layout: DashboardLayout; onChange: (layout: DashboardLayout) => void }) {
  const id = deviceKey(device);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const size = tileSize(layout, device);
  return (
    <div
      ref={setNodeRef}
      className={clsx('tile', `tile-${size}`, 'tile-edit', isDragging && 'tile-dragging')}
      // Translate only: tiles of different sizes must not be stretched to each other's size
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="tile-handle"
        {...attributes}
        {...listeners}
        aria-roledescription="verschiebbare Kachel"
        aria-label={`${device.name} verschieben`}
      >
        <TilePreview device={device} />
      </button>
      <div className="tile-edit-controls">
        <div className="dash-sizes" role="group" aria-label={`Größe von ${device.name}`}>
          {(['s', 'm', 'l'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={size === s} title={SIZE_NAMES[s]} aria-label={SIZE_NAMES[s]} onClick={() => onChange(setTileSize(layout, id, s))}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <button type="button" className="ghost icon-button dash-small-button" aria-label={`${device.name} ausblenden`} onClick={() => onChange(toggleHidden(layout, id))}>
          <EyeOff size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
