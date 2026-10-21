import { describe, expect, it } from 'vitest';

import type { Device, LiveEvent, Room } from '@smarthome/api-client';

import { controls, formatValue, isOn, isTemperature } from './capabilities';
import { applyToDevices, applyToPendingConfirmations, applyToRooms, groupByRoom } from './live';

// Exposes as the simulator (and Zigbee2MQTT) describe them
const light = {
  exposes: [
    {
      type: 'light',
      features: [
        { type: 'binary', name: 'state', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF' },
        { type: 'numeric', name: 'brightness', property: 'brightness', access: 7, value_min: 0, value_max: 254 },
      ],
    },
    { type: 'numeric', name: 'linkquality', property: 'linkquality', access: 1 },
  ],
};
const thermostat = {
  exposes: [
    {
      type: 'climate',
      features: [
        { type: 'numeric', property: 'occupied_heating_setpoint', access: 7, value_min: 4, value_max: 35, unit: '°C' },
        { type: 'numeric', property: 'local_temperature', access: 5, unit: '°C' },
        { type: 'enum', property: 'system_mode', access: 7, values: ['off', 'auto', 'heat'] },
      ],
    },
    { type: 'numeric', property: 'battery', access: 1, unit: '%' },
  ],
};
const lock = {
  exposes: [
    {
      type: 'lock',
      features: [
        { type: 'binary', property: 'state', access: 7, value_on: 'LOCK', value_off: 'UNLOCK' },
        { type: 'enum', property: 'lock_state', access: 5, values: ['locked', 'unlocked'] },
      ],
    },
  ],
};

describe('controls', () => {
  it('gives lights a power switch and a brightness slider, without link quality', () => {
    const c = controls('light', light);
    expect(c.power?.property).toBe('state');
    expect(c.settings.map((f) => f.property)).toEqual(['brightness']);
    expect(c.readouts).toEqual([]);
    expect(isOn(c.power!, { state: 'ON' })).toBe(true);
    expect(isOn(c.power!, { state: 'OFF' })).toBe(false);
  });

  it('gives thermostats a setpoint, a mode and readouts', () => {
    const c = controls('thermostat', thermostat);
    expect(c.power).toBeUndefined();
    expect(c.settings.map((f) => f.property)).toEqual(['occupied_heating_setpoint', 'system_mode']);
    expect(c.readouts.map((f) => f.property)).toEqual(['local_temperature', 'battery']);
    expect(isTemperature(c.settings[0]!)).toBe(true);
    expect(formatValue(c.readouts[0]!, 19.54)).toBe('19,5 °C');
  });

  it('treats the state of locks as lock, not as power', () => {
    const c = controls('lock', lock);
    expect(c.power).toBeUndefined();
    expect(c.lock?.on).toBe('LOCK');
    expect(c.readouts.map((f) => f.property)).toEqual(['lock_state']);
  });

  it('copes with devices without capabilities', () => {
    expect(controls('sensor', {})).toEqual({ settings: [], readouts: [] });
    expect(controls(undefined, undefined)).toEqual({ settings: [], readouts: [] });
  });
});

const event = <T extends LiveEvent['type']>(type: T, data: Extract<LiveEvent, { type: T }>['data']) =>
  ({ type, ts: '2026-10-21T12:00:00Z', data }) as Extract<LiveEvent, { type: T }>;

describe('live events', () => {
  const lamp: Device = { id: 1, name: 'Stehlampe', roomId: 10, state: { state: 'OFF', brightness: 100 } };
  const plug: Device = { id: 2, name: 'Steckdose', roomId: null as unknown as undefined, state: { state: 'ON' } };

  it('merges state updates into the device', () => {
    const next = applyToDevices([lamp, plug], event('device.state', { deviceId: 1, state: { state: 'ON' }, lastSeen: '2026-10-21T12:00:00Z' }));
    expect(next[0]?.state).toEqual({ state: 'ON', brightness: 100 });
    expect(next[0]?.lastSeen).toBe('2026-10-21T12:00:00Z');
    expect(next[1]).toBe(plug);
  });

  it('adds, replaces and removes devices', () => {
    const added = applyToDevices([lamp], event('device.added', { id: 3, name: 'Neu' }));
    expect(added.map((d) => d.id)).toEqual([1, 3]);
    const renamed = applyToDevices(added, event('device.updated', { ...lamp, name: 'Leselampe' }));
    expect(renamed[0]?.name).toBe('Leselampe');
    expect(applyToDevices(renamed, event('device.removed', { deviceId: 1 })).map((d) => d.id)).toEqual([3]);
  });

  it('keeps rooms in order', () => {
    const rooms: Room[] = [
      { id: 10, name: 'Wohnzimmer', sort: 0 },
      { id: 11, name: 'Küche', sort: 1 },
    ];
    const reordered = applyToRooms(rooms, event('rooms.reordered', { roomIds: [11, 10] }));
    expect(reordered.map((r) => r.id)).toEqual([11, 10]);
    const created = applyToRooms(reordered, event('room.created', { id: 12, name: 'Bad', sort: 5 }));
    expect(created.map((r) => r.id)).toEqual([11, 10, 12]);
  });

  it('drops decided confirmations', () => {
    const pending = applyToPendingConfirmations([], event('confirmation.created', { id: 5, status: 'pending' }));
    expect(pending.map((c) => c.id)).toEqual([5]);
    expect(applyToPendingConfirmations(pending, event('confirmation.approved', { id: 5, status: 'approved' }))).toEqual([]);
  });

  it('groups devices by room, devices without room last', () => {
    const groups = groupByRoom([{ id: 10, name: 'Wohnzimmer', sort: 0 }, { id: 11, name: 'Leer', sort: 1 }], [plug, lamp]);
    expect(groups.map((g) => g.room?.name ?? null)).toEqual(['Wohnzimmer', null]);
    expect(groups[1]?.devices).toEqual([plug]);
  });
});
