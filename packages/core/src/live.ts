// Applies live events to the lists the interface shows. Pure functions, so both web and app can use them
// with whatever state management they have.
import type { Confirmation, Device, LiveEvent, Room } from '@smarthome/api-client';

export function applyToDevices(devices: Device[], event: LiveEvent): Device[] {
  switch (event.type) {
    case 'device.state':
      return devices.map((d) =>
        d.id === event.data.deviceId
          ? { ...d, state: { ...(d.state ?? {}), ...event.data.state }, ...(event.data.lastSeen ? { lastSeen: event.data.lastSeen } : {}) }
          : d,
      );
    case 'device.added':
    case 'device.updated': {
      const updated = event.data;
      return devices.some((d) => d.id === updated.id)
        ? devices.map((d) => (d.id === updated.id ? updated : d))
        : [...devices, updated];
    }
    case 'device.removed':
      return devices.filter((d) => d.id !== event.data.deviceId);
    default:
      return devices;
  }
}

export function applyToRooms(rooms: Room[], event: LiveEvent): Room[] {
  switch (event.type) {
    case 'room.created':
    case 'room.updated': {
      const room = event.data;
      const next = rooms.some((r) => r.id === room.id) ? rooms.map((r) => (r.id === room.id ? room : r)) : [...rooms, room];
      return sortRooms(next);
    }
    case 'room.deleted':
      return rooms.filter((r) => r.id !== event.data.roomId);
    case 'rooms.reordered': {
      const order = new Map(event.data.roomIds.map((id, index) => [id, index]));
      return rooms
        .filter((r) => r.id !== undefined && order.has(r.id))
        .map((r) => ({ ...r, sort: order.get(r.id!) ?? r.sort }))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    }
    default:
      return rooms;
  }
}

/** Keeps the pending confirmations: new ones are added, decided or expired ones disappear. */
export function applyToPendingConfirmations(pending: Confirmation[], event: LiveEvent): Confirmation[] {
  switch (event.type) {
    case 'confirmation.created':
      return [event.data, ...pending.filter((c) => c.id !== event.data.id)];
    case 'confirmation.approved':
    case 'confirmation.rejected':
    case 'confirmation.expired':
      return pending.filter((c) => c.id !== event.data.id);
    default:
      return pending;
  }
}

/** Sorted like the backend: by sort, then name. */
export function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.name ?? '').localeCompare(b.name ?? '', 'de'));
}

export interface RoomGroup {
  room: Room | null;
  devices: Device[];
}

/** Devices grouped by room in room order; devices without a (visible) room come last. */
export function groupByRoom(rooms: Room[], devices: Device[]): RoomGroup[] {
  const known = new Set(rooms.map((r) => r.id));
  const byName = (a: Device, b: Device) => (a.name ?? '').localeCompare(b.name ?? '', 'de');
  const groups: RoomGroup[] = sortRooms(rooms)
    .map((room) => ({ room, devices: devices.filter((d) => d.roomId === room.id).sort(byName) }))
    .filter((g) => g.devices.length > 0);
  const rest = devices.filter((d) => d.roomId == null || !known.has(d.roomId)).sort(byName);
  if (rest.length > 0) {
    groups.push({ room: null, devices: rest });
  }
  return groups;
}
