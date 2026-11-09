// Widgets per user live on the server (/api/me/widgets, /api/me/widgets/data). This is the logic around them that does
// not depend on the screen: which kind a device gets, what the home screen widget draws from the compact data, taking
// over a selection that was stored on the phone before, and the server's limits in German.
import { ApiError, type components, type Device } from '@smarthome/api-client';

import { primaryAction, tileStatus } from './dashboard';

type S = components['schemas'];
export type ServerWidget = S['WidgetResponse'];
export type WidgetData = S['WidgetData'];

/** The home screen widget has room for this many tiles (the first ones the widget can draw, in server order). */
export const MAX_HOME_WIDGETS = 4;
/** The server accepts at most this many widgets per person. */
export const MAX_SERVER_WIDGETS = 50;

type Kind = NonNullable<ServerWidget['kind']>;

/** The kinds the home screen widget can draw; a "room" widget (device count) cannot be shown and is left out there. */
const DRAWN: readonly Kind[] = ['switch', 'dimmer', 'lock', 'thermostat', 'status'];

/** The kind a device gets when it is put on the widget. */
export function widgetKindFor(device: Pick<Device, 'type'>): Kind {
  switch (device.type) {
    case 'lock':
      return 'lock';
    case 'thermostat':
      return 'thermostat';
    case 'light':
    case 'switch':
      return 'switch';
    default:
      return 'status';
  }
}

/** Stored with the widget so the tile can show the right icon (plain text, a few bytes). */
export function widgetConfigFor(device: Pick<Device, 'type'>): Record<string, unknown> {
  return { deviceType: String(device.type ?? 'device').slice(0, 40) };
}

/** One tile of the home screen widget. */
export interface HomescreenItem {
  /** Key of the tile (the widget's id). */
  id: string;
  deviceId: number;
  /** The person lost the right to see the device: a neutral tile without name and without a tap. */
  placeholder: boolean;
  name: string;
  status: string;
  /** For the icon (device type, e.g. light, switch, lock). */
  deviceType: string;
  on: boolean;
  /** A tap switches ("toggle"), opens the app, or does nothing (placeholder). */
  tap: { kind: 'toggle'; command: Record<string, unknown> } | { kind: 'open' } | { kind: 'none' };
}

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const number = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/**
 * The tiles for the home screen widget from the server's compact data: the first {@code max} widgets it can draw, in
 * the server's order. Widgets of other kinds (rooms) and scenes are skipped. Texts from the server are only cut to
 * length here and shown as plain text. Locks never switch from the widget, whatever the widget's configuration says.
 */
export function homescreenItems(widgets: WidgetData[] | undefined, max: number = MAX_HOME_WIDGETS): HomescreenItem[] {
  const items: HomescreenItem[] = [];
  for (const widget of widgets ?? []) {
    if (items.length >= max) {
      break;
    }
    if (widget.targetType !== 'device' || widget.kind === undefined || !DRAWN.includes(widget.kind)) {
      continue;
    }
    items.push(tile(widget, widget.kind));
  }
  return items;
}

function tile(widget: WidgetData, kind: Kind): HomescreenItem {
  const id = String(widget.id ?? '');
  const deviceId = widget.targetId ?? 0;
  if (!widget.available) {
    return { id, deviceId, placeholder: true, name: '', status: 'Nicht verfügbar', deviceType: 'device', on: false, tap: { kind: 'none' } };
  }
  const state = widget.state ?? {};
  const fallbackType = kind === 'lock' ? 'lock' : kind === 'thermostat' ? 'thermostat' : 'device';
  const deviceType = text(widget.config?.['deviceType'], 40) || fallbackType;
  const name = text(widget.name, 60) || 'Gerät';
  const base = { id, deviceId, placeholder: false, name, deviceType };

  if (kind === 'lock') {
    const locked = state['state'] === 'LOCK' || state['lock_state'] === 'locked';
    return { ...base, status: locked ? 'Zu' : 'Offen', on: false, tap: { kind: 'open' } };
  }
  if (kind === 'thermostat') {
    const temperature = number(state['local_temperature']);
    return { ...base, status: temperature === undefined ? '–' : `${temperature.toFixed(1).replace('.', ',')} °C`, on: false, tap: { kind: 'open' } };
  }
  const power = state['state'];
  const on = power === 'ON';
  if (kind === 'status') {
    const watts = number(state['power']);
    const status = power === 'ON' ? 'An' : power === 'OFF' ? 'Aus' : watts !== undefined ? `${Math.round(watts)} W` : '';
    return { ...base, status, on, tap: { kind: 'open' } };
  }
  // switch and dimmer
  const brightness = number(state['brightness']);
  const status = power === 'ON' ? (brightness !== undefined ? `An · ${Math.round((brightness / 254) * 100)} %` : 'An') : power === 'OFF' ? 'Aus' : '–';
  const mayControl = (widget.actions ?? []).some((a) => a.action === 'control' && !a.requiresConfirmation);
  const switchable = (power === 'ON' || power === 'OFF') && mayControl;
  return { ...base, status, on, tap: switchable ? { kind: 'toggle', command: { state: on ? 'OFF' : 'ON' } } : { kind: 'open' } };
}

/** The tiles as they were last known, when the server cannot be reached: no state, no switching, just "Offline". */
export function staleItems(items: HomescreenItem[]): HomescreenItem[] {
  return items.map((item) => (item.placeholder ? item : { ...item, status: 'Offline', on: false, tap: { kind: 'open' } }));
}

/** Ids (as the dashboard writes them) of the devices that are on the widget. */
export function widgetDeviceIds(widgets: ServerWidget[] | undefined): Set<string> {
  return new Set((widgets ?? []).filter((w) => w.targetType === 'device' && w.targetId !== undefined).map((w) => String(w.targetId)));
}

/** All widgets of one device (a device can be on the widget with more than one kind). */
export function widgetsOfDevice(widgets: ServerWidget[] | undefined, deviceId: number): ServerWidget[] {
  return (widgets ?? []).filter((w) => w.targetType === 'device' && w.targetId === deviceId);
}

/** How many tiles the home screen widget can draw from these widgets (so how many devices are "on the widget"). */
export function homeWidgetCount(widgets: ServerWidget[] | undefined): number {
  return (widgets ?? []).filter((w) => w.targetType === 'device' && w.kind !== undefined && DRAWN.includes(w.kind)).length;
}

export interface WidgetToCreate {
  deviceId: number;
  kind: Kind;
  config: Record<string, unknown>;
}

/**
 * One-time takeover of a selection stored on the phone before widgets lived on the server: only when the server has no
 * widget yet, the devices that still exist, in the stored order, at most {@link MAX_HOME_WIDGETS}. A server that has
 * widgets already (another phone uploaded first) gets nothing, so nothing is duplicated.
 */
export function widgetsToTakeOver(local: string[] | undefined, server: ServerWidget[] | undefined, devices: Array<Pick<Device, 'id' | 'type'>>): WidgetToCreate[] {
  if ((server ?? []).length > 0) {
    return [];
  }
  const byId = new Map(devices.filter((d) => d.id !== undefined).map((d) => [String(d.id), d]));
  const result: WidgetToCreate[] = [];
  for (const id of local ?? []) {
    const device = byId.get(id);
    if (device && !result.some((r) => r.deviceId === device.id) && result.length < MAX_HOME_WIDGETS) {
      result.push({ deviceId: device.id!, kind: widgetKindFor(device), config: widgetConfigFor(device) });
    }
  }
  return result;
}

/**
 * What is still missing when an earlier takeover was interrupted (some widgets were created, the rest failed): the
 * stored selection without the devices that are on the server already.
 */
export function widgetsStillToTakeOver(local: string[] | undefined, server: ServerWidget[] | undefined, devices: Array<Pick<Device, 'id' | 'type'>>): WidgetToCreate[] {
  const present = new Set((server ?? []).filter((w) => w.targetType === 'device').map((w) => w.targetId));
  return widgetsToTakeOver(local, [], devices).filter((w) => !present.has(w.deviceId));
}

/** The server's English refusals (limits, rights) as a German sentence; anything else as the backend says it. */
export function widgetErrorText(error: unknown, fallback = 'Das hat nicht geklappt'): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  const message = error.message;
  if (/At most \d+ widgets/i.test(message)) {
    return `Es sind höchstens ${MAX_SERVER_WIDGETS} Widgets möglich.`;
  }
  if (/config must be at most/i.test(message)) {
    return 'Die Einstellungen des Widgets sind zu groß.';
  }
  if (/No (device|room) with id/i.test(message)) {
    return 'Das geht nicht: Du darfst dieses Gerät nicht sehen, oder es gibt es nicht mehr.';
  }
  if (/does not fit|widget needs a/i.test(message)) {
    return 'Diese Widget-Art passt nicht zu diesem Gerät.';
  }
  if (/Scenes are not available/i.test(message)) {
    return 'Szenen gibt es noch nicht.';
  }
  if (/No widget with id/i.test(message)) {
    return 'Dieses Widget gibt es nicht mehr.';
  }
  if (/widgetIds must contain/i.test(message)) {
    return 'Die Reihenfolge hat sich inzwischen geändert. Bitte noch einmal versuchen.';
  }
  return message || fallback;
}

/** What a tap on a tile that was drawn earlier leads to, decided against freshly loaded tiles. */
export type TapDecision = { send: true } | { send: false; reason: 'gone' | 'other-device' | 'unavailable' | 'not-switchable' };

/**
 * A tap is bound to the widget id and device id the tile had when it was drawn, never to its position. After the tiles
 * were loaded again a command goes out only if that same widget still points at that same device, is still available
 * and can be switched from the widget. Locks and every other kind that opens the app never switch from here. The
 * backend's rights check stays the real limit; this only avoids sending what is already known to be wrong.
 */
export function decideTap(tapped: { id: string; deviceId: number }, fresh: HomescreenItem[]): TapDecision {
  const item = fresh.find((i) => i.id === tapped.id);
  if (!item) {
    return { send: false, reason: 'gone' };
  }
  if (item.placeholder) {
    return { send: false, reason: 'unavailable' };
  }
  if (item.deviceId !== tapped.deviceId) {
    return { send: false, reason: 'other-device' };
  }
  return item.tap.kind === 'toggle' ? { send: true } : { send: false, reason: 'not-switchable' };
}

/** The tile of a single device widget when the person may not see the device (or it is gone): neutral, no name, no tap. */
export function unavailableItem(deviceId: number): HomescreenItem {
  return { id: String(deviceId), deviceId, placeholder: true, name: '', status: 'Nicht verfügbar', deviceType: 'device', on: false, tap: { kind: 'none' } };
}

/**
 * The tile of a single device widget from the device as the device API gives it (GET /api/devices/{id}, which answers
 * 404 for a device the person may not see). The same rules as for the quick switch tiles: lights, plugs and switches
 * the person may control switch on a tap, unless the action is locked or needs an approval; locks, thermostats,
 * sensors and the rest show their value and open the app. Texts from the server are only cut to length.
 */
export function deviceItem(device: Device): HomescreenItem {
  const deviceId = device.id ?? 0;
  const id = String(deviceId);
  const status = tileStatus(device);
  const action = primaryAction(device);
  const locked = (device.lockedActions ?? []).includes('control');
  const needsApproval = (device.permissions ?? []).some((p) => p.action === 'control' && p.requiresConfirmation === true);
  const switchable = action.kind === 'toggle' && !locked && !needsApproval;
  return {
    id,
    deviceId,
    placeholder: false,
    name: text(device.name, 60) || 'Gerät',
    status: status === 'Abgeschlossen' ? 'Zu' : text(status, 40),
    deviceType: text(device.type, 40) || 'device',
    on: action.kind === 'toggle' && action.on,
    tap: switchable ? { kind: 'toggle', command: action.command } : { kind: 'open' },
  };
}
