import { describe, expect, it } from 'vitest';

import type { Device, LiveEvent, Room } from '@smarthome/api-client';

import { actionLabel, colorTempHint, commandIntent, guardedActions, lockedReason, controls, formatValue, isColorTemp, isOn, isTemperature, label, miredToKelvin, optionLabel, type Feature } from './capabilities';
import { applyToDevices, applyToPendingConfirmations, applyToRooms, greeting, groupByRoom, homeFacts, homeSummary } from './live';

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

describe('readable values', () => {
  it('translates modes and running states', () => {
    expect(['off', 'auto', 'heat', 'cool'].map((v) => optionLabel('system_mode', v))).toEqual(['Aus', 'Automatik', 'Heizen', 'Kühlen']);
    expect(['idle', 'heat', 'heating'].map((v) => optionLabel('running_state', v))).toEqual(['Inaktiv', 'Heizt', 'Heizt']);
    expect(optionLabel('lock_state', 'locked')).toBe('Abgeschlossen');
    expect(optionLabel('effect', 'color_loop')).toBe('color loop');
    expect(label('running_state')).toBe('Zustand');
  });

  it('formats enums, text and binary readouts readably', () => {
    const mode: Feature = { kind: 'enum', property: 'system_mode', settable: true, values: ['off', 'heat'] };
    expect(formatValue(mode, 'heat')).toBe('Heizen');
    const running: Feature = { kind: 'text', property: 'running_state', settable: false };
    expect(formatValue(running, 'idle')).toBe('Inaktiv');
    expect(formatValue(running, 'Some_text')).toBe('Some_text');
    const occupancy: Feature = { kind: 'binary', property: 'occupancy', settable: false, on: true, off: false };
    expect(formatValue(occupancy, true)).toBe('Ja');
    expect(formatValue(occupancy, false)).toBe('Nein');
  });

  it('shows colour temperature in Kelvin, rounded to 50 K', () => {
    expect(miredToKelvin(250)).toBe(4000);
    expect(miredToKelvin(370)).toBe(2700);
    expect(miredToKelvin(153)).toBe(6550);
    expect(miredToKelvin(0)).toBe(0);
    expect(formatValue({ kind: 'numeric', property: 'color_temp', settable: true }, 0)).toBe('–');
    const colorTemp: Feature = { kind: 'numeric', property: 'color_temp', settable: true, min: 153, max: 500, unit: 'mired' };
    expect(isColorTemp(colorTemp)).toBe(true);
    expect(formatValue(colorTemp, 250)).toBe('4.000 K');
    expect([colorTempHint(2700), colorTempHint(4000), colorTempHint(6500)]).toEqual(['warm', 'neutral', 'kalt']);
  });
});

describe('commandIntent', () => {
  const door = { type: 'lock', name: 'Haustür', capabilities: lock, permissions: [{ action: 'control' }, { action: 'unlock', requiresConfirmation: true }] };
  const lamp = { type: 'light', name: 'Lampe', capabilities: light, permissions: [{ action: 'control', requiresConfirmation: true }] };

  it('asks before opening a door that needs an approval', () => {
    expect(commandIntent(door, { state: 'UNLOCK' })).toEqual({ action: 'unlock', requiresConfirmation: true, question: 'Wirklich öffnen?', verb: 'Öffnen', done: 'Tür geöffnet' });
    expect(commandIntent(door, { state: 'LOCK' })).toMatchObject({ action: 'control', requiresConfirmation: false, verb: 'Abschließen' });
  });

  it('names switching and other changes', () => {
    expect(commandIntent(lamp, { state: 'ON' })).toMatchObject({ requiresConfirmation: true, question: 'Wirklich einschalten?', done: 'Lampe eingeschaltet' });
    expect(commandIntent(lamp, { brightness: 100 })).toMatchObject({ question: 'Wirklich ändern?' });
    expect(commandIntent({ ...lamp, permissions: [{ action: 'control' }] }, { state: 'OFF' }).requiresConfirmation).toBe(false);
  });

  it('knows locked actions', () => {
    const plug = { ...lamp, lockedActions: ['switch_off', 'set_brightness'] };
    expect(guardedActions(plug, { state: 'OFF' })).toEqual(['switch_off']);
    expect(lockedReason(plug, { state: 'OFF' })).toBe('Ausschalten ist gesperrt');
    expect(lockedReason(plug, { state: 'ON' })).toBeUndefined();
    expect(commandIntent(plug, { brightness: 3 }).locked).toBe('Helligkeit setzen ist gesperrt');
    expect(guardedActions(door, { state: 'UNLOCK' })).toEqual(['unlock']);
  });
});

describe('actionLabel', () => {
  it('names actions, set_ actions after their property', () => {
    expect(actionLabel('switch_on')).toBe('Einschalten');
    expect(actionLabel('unlock')).toBe('Aufschließen');
    expect(actionLabel('set_brightness')).toBe('Helligkeit setzen');
    expect(actionLabel('set_some_value')).toBe('some value setzen');
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

  it('sums up the home: devices on and the first room temperature', () => {
    const lit: Device = { id: 4, name: 'Lampe', type: 'light', roomId: 10, capabilities: light, state: { state: 'ON' } };
    const heating: Device = { id: 5, name: 'Heizung', type: 'thermostat', roomId: 11, capabilities: thermostat, state: { local_temperature: 20.84 } };
    const living: Room = { id: 10, name: 'Wohnzimmer', sort: 0 };
    const kitchen: Room = { id: 11, name: 'Küche', sort: 1 };
    expect(homeSummary(groupByRoom([living, kitchen], [lit, heating]))).toBe('1 Gerät an · 20,8 °C Küche');
    expect(homeSummary(groupByRoom([living], [{ ...lit, state: { state: 'OFF' } }]))).toBe('Alles aus');
    // nothing switchable: no "Alles aus", just the temperature (or nothing)
    expect(homeSummary(groupByRoom([kitchen], [heating]))).toBe('20,8 °C Küche');
    expect(homeSummary(groupByRoom([kitchen], [{ ...heating, state: {} }]))).toBe('');
    // the same as data
    expect(homeFacts(groupByRoom([living, kitchen], [lit, heating]))).toEqual({ switchable: 1, onCount: 1, temperature: { value: '20,8 °C', room: 'Küche' } });
    expect(homeFacts(groupByRoom([living], [{ ...lit, state: { state: 'OFF' } }]))).toEqual({ switchable: 1, onCount: 0 });
    expect(homeFacts(groupByRoom([kitchen], [heating]))).toEqual({ switchable: 0, onCount: 0, temperature: { value: '20,8 °C', room: 'Küche' } });
    expect(homeFacts(groupByRoom([kitchen], [{ ...heating, state: {} }]))).toEqual({ switchable: 0, onCount: 0 });
  });

  it('greets by time of day with the first name', () => {
    expect(greeting('Anna Muster', new Date(2026, 0, 1, 8))).toBe('Guten Morgen, Anna');
    expect(greeting(undefined, new Date(2026, 0, 1, 20))).toBe('Guten Abend');
  });

  it('groups devices by room, devices without room last', () => {
    const groups = groupByRoom([{ id: 10, name: 'Wohnzimmer', sort: 0 }, { id: 11, name: 'Leer', sort: 1 }], [plug, lamp]);
    expect(groups.map((g) => g.room?.name ?? null)).toEqual(['Wohnzimmer', null]);
    expect(groups[1]?.devices).toEqual([plug]);
  });
});
