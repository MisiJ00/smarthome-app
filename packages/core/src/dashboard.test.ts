import { describe, expect, it } from 'vitest';

import type { Device, Room } from '@smarthome/api-client';

import {
  arrangeDevices,
  defaultLayout,
  defaultTileSize,
  hiddenDevices,
  MAX_WIDGET,
  moveDevice,
  parseLayout,
  primaryAction,
  pruneLayout,
  setTileSize,
  tileSize,
  tileStatus,
  toggleHidden,
  toggleWidget,
  withFullOrder,
  type DashboardLayout,
} from './dashboard';

const lightCaps = {
  exposes: [
    {
      type: 'light',
      features: [
        { type: 'binary', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF' },
        { type: 'numeric', property: 'brightness', access: 7, value_min: 0, value_max: 254 },
      ],
    },
  ],
};
const thermostatCaps = {
  exposes: [{ type: 'climate', features: [{ type: 'numeric', property: 'local_temperature', access: 5, unit: '°C' }] }],
};
const lockCaps = { exposes: [{ type: 'lock', features: [{ type: 'binary', property: 'state', access: 7, value_on: 'LOCK', value_off: 'UNLOCK' }] }] };
const control = [{ action: 'control' as const }];

const living: Room = { id: 10, name: 'Wohnzimmer', sort: 0 };
const hall: Room = { id: 11, name: 'Flur', sort: 1 };
const rooms = [hall, living];

const lamp: Device = { id: 1, name: 'Stehlampe', type: 'light', roomId: 10, capabilities: lightCaps, state: { state: 'ON', brightness: 203 }, permissions: control };
const heater: Device = { id: 2, name: 'Heizung', type: 'thermostat', roomId: 10, capabilities: thermostatCaps, state: { local_temperature: 21.46 } };
const hallLamp: Device = { id: 3, name: 'Flurlampe', type: 'light', roomId: 11, capabilities: lightCaps, state: { state: 'OFF' }, permissions: control };
const door: Device = { id: 4, name: 'Haustür', type: 'lock', roomId: 11, capabilities: lockCaps, state: { state: 'LOCK' }, permissions: control };
const loose: Device = { id: 5, name: 'Sensor', type: 'sensor', capabilities: {} };
const all = [lamp, heater, hallLamp, door, loose];

const ids = (devices: Device[]) => devices.map((d) => d.id);
const layout = (patch: Partial<DashboardLayout>): DashboardLayout => ({ ...defaultLayout(), ...patch });

describe('arrangeDevices', () => {
  it('starts in room order with devices by name, devices without room last', () => {
    const groups = arrangeDevices(all, defaultLayout(), [living, hall]);
    expect(groups.map((g) => g.room?.name ?? null)).toEqual(['Wohnzimmer', 'Flur', null]);
    expect(groups.map((g) => ids(g.devices))).toEqual([[2, 1], [3, 4], [5]]);
  });

  it('follows the own order, new devices at the end, removed ones ignored', () => {
    const custom = layout({ grouping: 'custom', order: ['4', '99', '1'] });
    expect(arrangeDevices(all, custom, rooms).map((g) => ids(g.devices))).toEqual([[4, 1, 2, 3, 5]]);
  });

  it('groups by room keeping the relative order and leaves out hidden devices', () => {
    const grouped = layout({ order: ['1', '4', '2', '3'], hidden: ['3'] });
    const groups = arrangeDevices(all, grouped, [living, hall]);
    expect(groups.map((g) => ids(g.devices))).toEqual([[1, 2], [4], [5]]);
    expect(ids(hiddenDevices(all, grouped, rooms))).toEqual([3]);
  });

  it('gives no groups without visible devices', () => {
    expect(arrangeDevices([], layout({ grouping: 'custom' }))).toEqual([]);
    expect(arrangeDevices([lamp], layout({ hidden: ['1'] }), rooms)).toEqual([]);
  });
});

describe('changing the layout', () => {
  it('moves a device like arrayMove', () => {
    const full = withFullOrder(layout({ grouping: 'custom' }), all, [living, hall]);
    expect(full.order).toEqual(['2', '1', '3', '4', '5']);
    expect(moveDevice(full, '5', 0).order).toEqual(['5', '2', '1', '3', '4']);
    expect(moveDevice(full, '2', 3).order).toEqual(['1', '3', '4', '2', '5']);
    expect(moveDevice(full, '1', 99).order).toEqual(['2', '3', '4', '5', '1']);
  });

  it('sets sizes, hides and shows', () => {
    expect(tileSize(setTileSize(defaultLayout(), '1', 'l'), lamp)).toBe('l');
    expect(tileSize(defaultLayout(), lamp)).toBe('s');
    const hidden = toggleHidden(defaultLayout(), '1');
    expect(hidden.hidden).toEqual(['1']);
    expect(toggleHidden(hidden, '1').hidden).toEqual([]);
  });

  it('keeps at most four devices in the widget', () => {
    let l = defaultLayout();
    for (const id of ['1', '2', '3', '4', '5']) {
      l = toggleWidget(l, id);
    }
    expect(l.widget).toEqual(['1', '2', '3', '4']);
    expect(l.widget).toHaveLength(MAX_WIDGET);
    expect(toggleWidget(l, '2').widget).toEqual(['1', '3', '4']);
  });

  it('drops devices that are gone', () => {
    const old = layout({ order: ['1', '9', '2'], sizes: { '9': 'l', '1': 'm' }, hidden: ['9'], widget: ['9', '2'] });
    expect(pruneLayout(old, ['1', '2'])).toEqual(layout({ order: ['1', '2'], sizes: { '1': 'm' }, hidden: [], widget: ['2'] }));
  });

  it('picks default sizes by type', () => {
    expect([lamp, heater, door, loose, { ...lamp, type: 'switch' }].map(defaultTileSize)).toEqual(['s', 'm', 'm', 'm', 's']);
  });
});

describe('parseLayout', () => {
  it('copes with rubbish', () => {
    for (const rubbish of [undefined, null, '', '{', '[]', 42, { version: 2 }, 'null']) {
      expect(parseLayout(rubbish)).toEqual(defaultLayout());
    }
  });

  it('keeps the valid parts', () => {
    const parsed = parseLayout(
      JSON.stringify({ version: 1, order: ['2', '2', '1'], sizes: { '1': 'l', '2': 'xxl' }, hidden: 'no', widget: ['1', '2', '3', '4', '5'], grouping: 'custom' }),
    );
    expect(parsed).toEqual({ version: 1, order: ['2', '1'], sizes: { '1': 'l' }, hidden: [], widget: ['1', '2', '3', '4'], grouping: 'custom' });
  });
});

describe('tiles', () => {
  it('switches lights on a tap, opens details for locks, sensors and without permission', () => {
    expect(primaryAction(lamp)).toEqual({ kind: 'toggle', on: true, command: { state: 'OFF' } });
    expect(primaryAction(hallLamp)).toEqual({ kind: 'toggle', on: false, command: { state: 'ON' } });
    expect(primaryAction(door)).toEqual({ kind: 'details' });
    expect(primaryAction(loose)).toEqual({ kind: 'details' });
    expect(primaryAction({ ...lamp, permissions: [] })).toEqual({ kind: 'details' });
  });

  it('describes the state shortly', () => {
    expect(tileStatus(lamp)).toBe('An · 80 %');
    expect(tileStatus(hallLamp)).toBe('Aus');
    expect(tileStatus(heater)).toBe('21,5 °C');
    expect(tileStatus(door)).toBe('Abgeschlossen');
    expect(tileStatus(loose)).toBe('');
  });
});
