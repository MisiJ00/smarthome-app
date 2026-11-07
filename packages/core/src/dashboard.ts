// The user's dashboard: order, tile sizes, hidden devices, widget devices and grouping (docs/DESIGN-V2.md, 2).
// Pure functions, stored per user by the web (localStorage) and the app (AsyncStorage) as JSON.
import type { Device, Room } from '@smarthome/api-client';

import { controls, formatValue, isOn, optionLabel, type Feature } from './capabilities';
import { sortRooms, type RoomGroup } from './live';

export type TileSize = 's' | 'm' | 'l';
export type Grouping = 'rooms' | 'custom';

export interface DashboardLayout {
  version: 1;
  /** Device ids (as strings) in the user's order; devices not in it come after, in the default order. */
  order: string[];
  /** Chosen tile sizes; without an entry {@link defaultTileSize}. */
  sizes: Record<string, TileSize>;
  hidden: string[];
  /** Devices on the phone's home screen widget, at most {@link MAX_WIDGET}. */
  widget: string[];
  grouping: Grouping;
}

export const MAX_WIDGET = 4;

export function defaultLayout(): DashboardLayout {
  return { version: 1, order: [], sizes: {}, hidden: [], widget: [], grouping: 'rooms' };
}

/** The id of a device as used in the layout. */
export function deviceKey(device: Device): string {
  return String(device.id);
}

const SIZES: readonly TileSize[] = ['s', 'm', 'l'];
const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string');
const unique = (ids: string[]) => [...new Set(ids)];

/** A stored layout (JSON text or already parsed); anything broken or unknown gives the default (or drops the broken part). */
export function parseLayout(json: unknown): DashboardLayout {
  let data: unknown = json;
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json);
    } catch {
      return defaultLayout();
    }
  }
  if (typeof data !== 'object' || data === null || (data as { version?: unknown }).version !== 1) {
    return defaultLayout();
  }
  const raw = data as Record<string, unknown>;
  const sizes: Record<string, TileSize> = {};
  if (typeof raw['sizes'] === 'object' && raw['sizes'] !== null && !Array.isArray(raw['sizes'])) {
    for (const [id, size] of Object.entries(raw['sizes'] as Record<string, unknown>)) {
      if (SIZES.includes(size as TileSize)) {
        sizes[id] = size as TileSize;
      }
    }
  }
  return {
    version: 1,
    order: isIdList(raw['order']) ? unique(raw['order']) : [],
    sizes,
    hidden: isIdList(raw['hidden']) ? unique(raw['hidden']) : [],
    widget: isIdList(raw['widget']) ? unique(raw['widget']).slice(0, MAX_WIDGET) : [],
    grouping: raw['grouping'] === 'custom' ? 'custom' : 'rooms',
  };
}

/** Lights, plugs and switches are small tiles (a tap switches them), everything else medium. */
export function defaultTileSize(device: Device): TileSize {
  return ['light', 'switch', 'plug'].includes(device.type ?? '') ? 's' : 'm';
}

export function tileSize(layout: DashboardLayout, device: Device): TileSize {
  return layout.sizes[deviceKey(device)] ?? defaultTileSize(device);
}

/** The default order without any choice of the user: rooms in their order, devices by name, devices without room last. */
function defaultOrder(devices: Device[], rooms: Room[]): Device[] {
  const roomIndex = new Map(sortRooms(rooms).map((r, i) => [r.id, i]));
  const rank = (d: Device) => (d.roomId != null && roomIndex.has(d.roomId) ? roomIndex.get(d.roomId)! : Number.MAX_SAFE_INTEGER);
  return [...devices].sort((a, b) => rank(a) - rank(b) || (a.name ?? '').localeCompare(b.name ?? '', 'de'));
}

/** All devices (hidden ones too) in the user's order; devices not in the order (new ones) at the end. */
export function orderedDevices(devices: Device[], layout: DashboardLayout, rooms: Room[] = []): Device[] {
  const position = new Map(layout.order.map((id, i) => [id, i]));
  const base = defaultOrder(devices, rooms);
  const baseIndex = new Map(base.map((d, i) => [d, i]));
  const at = (d: Device) => position.get(deviceKey(d)) ?? layout.order.length + baseIndex.get(d)!;
  return base.sort((a, b) => at(a) - at(b));
}

/**
 * The visible devices in the user's order. Grouping "rooms": one group per room (rooms in their order, devices
 * without room last), keeping the order within each; "custom": one group with room null. Devices the layout knows
 * but that are gone are simply not there.
 */
export function arrangeDevices(devices: Device[], layout: DashboardLayout, rooms: Room[] = []): RoomGroup[] {
  const hidden = new Set(layout.hidden);
  const visible = orderedDevices(devices, layout, rooms).filter((d) => !hidden.has(deviceKey(d)));
  if (layout.grouping === 'custom') {
    return visible.length > 0 ? [{ room: null, devices: visible }] : [];
  }
  const known = new Set(rooms.map((r) => r.id));
  const groups: RoomGroup[] = sortRooms(rooms)
    .map((room) => ({ room, devices: visible.filter((d) => d.roomId === room.id) }))
    .filter((g) => g.devices.length > 0);
  const rest = visible.filter((d) => d.roomId == null || !known.has(d.roomId));
  if (rest.length > 0) {
    groups.push({ room: null, devices: rest });
  }
  return groups;
}

/** The hidden devices, in the user's order (shown under "Ausgeblendet" while editing). */
export function hiddenDevices(devices: Device[], layout: DashboardLayout, rooms: Room[] = []): Device[] {
  const hidden = new Set(layout.hidden);
  return orderedDevices(devices, layout, rooms).filter((d) => hidden.has(deviceKey(d)));
}

/** Writes the current order of all devices into the layout, so that moving works with indexes of that list. */
export function withFullOrder(layout: DashboardLayout, devices: Device[], rooms: Room[] = []): DashboardLayout {
  return { ...layout, order: orderedDevices(devices, layout, rooms).map(deviceKey) };
}

/** Moves a device to `toIndex` of the order (like arrayMove: taken out, then inserted there). */
export function moveDevice(layout: DashboardLayout, id: string, toIndex: number): DashboardLayout {
  const order = layout.order.filter((x) => x !== id);
  const index = Math.max(0, Math.min(order.length, Math.trunc(toIndex)));
  order.splice(index, 0, id);
  return { ...layout, order };
}

export function setTileSize(layout: DashboardLayout, id: string, size: TileSize): DashboardLayout {
  return { ...layout, sizes: { ...layout.sizes, [id]: size } };
}

export function toggleHidden(layout: DashboardLayout, id: string): DashboardLayout {
  return { ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] };
}

/** Adds a device to the widget or removes it; a fifth one is not added (the layout stays as it is). */
export function toggleWidget(layout: DashboardLayout, id: string): DashboardLayout {
  if (layout.widget.includes(id)) {
    return { ...layout, widget: layout.widget.filter((x) => x !== id) };
  }
  return layout.widget.length >= MAX_WIDGET ? layout : { ...layout, widget: [...layout.widget, id] };
}

/** Drops ids of devices that are gone (removed or no longer visible to the user) before saving. */
export function pruneLayout(layout: DashboardLayout, existing: string[]): DashboardLayout {
  const known = new Set(existing);
  const keep = (ids: string[]) => ids.filter((id) => known.has(id));
  return {
    ...layout,
    order: keep(layout.order),
    sizes: Object.fromEntries(Object.entries(layout.sizes).filter(([id]) => known.has(id))),
    hidden: keep(layout.hidden),
    widget: keep(layout.widget),
  };
}

export function setGrouping(layout: DashboardLayout, grouping: Grouping): DashboardLayout {
  return { ...layout, grouping };
}

export type PrimaryAction =
  | { kind: 'toggle'; on: boolean; command: Record<string, unknown> }
  | { kind: 'details' };

/**
 * What a tap on a small tile does: lights, plugs and switches the user may control switch on/off; locks (opening
 * may need an approval), sensors and the rest open the details.
 */
export function primaryAction(device: Device): PrimaryAction {
  const power = controls(device.type, device.capabilities).power;
  const canControl = (device.permissions ?? []).some((p) => p.action === 'control');
  if (!power || device.type === 'lock' || !canControl) {
    return { kind: 'details' };
  }
  const on = isOn(power, device.state);
  return { kind: 'toggle', on, command: { [power.property]: on ? power.off : power.on } };
}

const percent = (f: Extract<Feature, { kind: 'numeric' }>, value: number) => {
  const min = f.min ?? 0;
  const max = f.max ?? 100;
  return max > min ? Math.round(((value - min) / (max - min)) * 100) : 100;
};

/** The short state on a tile: "An · 80 %", "Aus", "21,5 °C", "Abgeschlossen". */
export function tileStatus(device: Device): string {
  const state = device.state ?? {};
  const c = controls(device.type, device.capabilities);
  if (c.lock) {
    return isOn(c.lock, state) ? 'Abgeschlossen' : 'Offen';
  }
  if (c.power) {
    if (!isOn(c.power, state)) {
      return 'Aus';
    }
    const brightness = c.settings.find((f): f is Extract<Feature, { kind: 'numeric' }> => f.kind === 'numeric' && f.property === 'brightness');
    const value = brightness ? state[brightness.property] : undefined;
    return brightness && typeof value === 'number' ? `An · ${percent(brightness, value)} %` : 'An';
  }
  const all = [...c.readouts, ...c.settings];
  const temperature = all.find((f) => f.property === 'local_temperature' || f.property === 'temperature');
  if (temperature && typeof state[temperature.property] === 'number') {
    return formatValue(temperature, state[temperature.property]);
  }
  const first = c.readouts.find((f) => state[f.property] !== undefined && state[f.property] !== null);
  if (first) {
    const value = state[first.property];
    return first.kind === 'enum' && typeof value === 'string' ? optionLabel(first.property, value) : formatValue(first, value);
  }
  return '';
}
