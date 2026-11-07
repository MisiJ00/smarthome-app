// Applies live events to the lists the interface shows. Pure functions, so both web and app can use them
// with whatever state management they have.
import type { Confirmation, Device, LiveEvent, Room } from '@smarthome/api-client';

import { controls, deviceTemperature, isDeviceOn } from './capabilities';

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

/** What {@link homeSummary} tells, as data: for UIs that show each fact on its own. */
export interface HomeFacts {
	/** Devices that can be switched on and off; 0 means there is nothing to say about "on". */
	switchable: number;
	/** How many of them are on. */
	onCount: number;
	/** The temperature of the first room that reports one ("20,8 °C"), with the room's name if it has one. */
	temperature?: { value: string; room?: string };
}

/** "Alles aus", "1 Gerät an" or "3 Geräte an". */
export function powerSummary(onCount: number): string {
	return onCount === 0 ? 'Alles aus' : `${onCount} ${onCount === 1 ? 'Gerät' : 'Geräte'} an`;
}

/** The facts behind {@link homeSummary}. */
export function homeFacts(groups: RoomGroup[]): HomeFacts {
	const switchable = groups.flatMap((g) => g.devices).filter((d) => controls(d.type, d.capabilities).power !== undefined);
	const facts: HomeFacts = { switchable: switchable.length, onCount: switchable.filter(isDeviceOn).length };
	for (const group of groups) {
		const value = group.devices.map(deviceTemperature).find((t) => t !== undefined);
		if (value !== undefined) {
			facts.temperature = group.room ? { value, room: group.room.name } : { value };
			break;
		}
	}
	return facts;
}

/**
 * One line about the home, for the head of the device list: "3 Geräte an · 20,8 °C Wohnzimmer" (switched-on devices
 * and the temperature of the first room that reports one). Without switchable devices there is no "Alles aus"; with
 * nothing to tell at all the text is empty.
 */
export function homeSummary(groups: RoomGroup[]): string {
	const facts = homeFacts(groups);
	const parts: string[] = [];
	if (facts.switchable > 0) {
		parts.push(powerSummary(facts.onCount));
	}
	if (facts.temperature) {
		const { value, room } = facts.temperature;
		parts.push(room ? `${value} ${room}` : value);
	}
	return parts.join(' · ');
}

/** "Guten Morgen, Anna" by the time of day, with the first name only. */
export function greeting(name: string | undefined, now = new Date()): string {
  const hour = now.getHours();
  const text = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${text}, ${first}` : text;
}
