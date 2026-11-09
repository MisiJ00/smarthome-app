import { describe, expect, it } from 'vitest';

import { ApiError } from '@smarthome/api-client';

import {
  homeWidgetCount,
  homescreenItems,
  staleItems,
  widgetDeviceIds,
  widgetErrorText,
  widgetKindFor,
  widgetsOfDevice,
  widgetsStillToTakeOver,
  widgetsToTakeOver,
  type ServerWidget,
  type WidgetData,
} from './widgets';

const data = (patch: Partial<WidgetData>): WidgetData => ({
  id: 1,
  kind: 'switch',
  targetType: 'device',
  targetId: 7,
  available: true,
  name: 'Stehlampe',
  state: { state: 'ON', brightness: 127 },
  actions: [{ action: 'control', requiresConfirmation: false }],
  config: { deviceType: 'light' },
  ...patch,
});

describe('home screen tiles from the server data', () => {
  it('draws a switch with its state and a tap that switches', () => {
    const [item] = homescreenItems([data({})]);
    expect(item).toMatchObject({ id: '1', deviceId: 7, name: 'Stehlampe', status: 'An · 50 %', on: true, deviceType: 'light', placeholder: false });
    expect(item?.tap).toEqual({ kind: 'toggle', command: { state: 'OFF' } });
    expect(homescreenItems([data({ state: { state: 'OFF' } })])[0]?.tap).toEqual({ kind: 'toggle', command: { state: 'ON' } });
  });

  it('opens the app instead when switching needs an approval or is not allowed', () => {
    expect(homescreenItems([data({ actions: [{ action: 'control', requiresConfirmation: true }] })])[0]?.tap).toEqual({ kind: 'open' });
    expect(homescreenItems([data({ actions: [] })])[0]?.tap).toEqual({ kind: 'open' });
    expect(homescreenItems([data({ state: {} })])[0]?.tap).toEqual({ kind: 'open' });
  });

  it('never switches a lock from the widget, whatever the configuration says', () => {
    const lock = homescreenItems([
      data({ kind: 'lock', name: 'Haustür', state: { state: 'LOCK' }, actions: [{ action: 'control', requiresConfirmation: false }, { action: 'unlock', requiresConfirmation: true }], config: { deviceType: 'lock', toggle: true, command: { state: 'UNLOCK' } } }),
    ])[0];
    expect(lock?.status).toBe('Zu');
    expect(lock?.tap).toEqual({ kind: 'open' });
    expect(homescreenItems([data({ kind: 'lock', state: { state: 'UNLOCK' } })])[0]?.status).toBe('Offen');
  });

  it('shows thermostats and status widgets and opens the app for them', () => {
    const thermostat = homescreenItems([data({ kind: 'thermostat', state: { local_temperature: 20.84 }, config: {} })])[0];
    expect(thermostat).toMatchObject({ status: '20,8 °C', deviceType: 'thermostat' });
    expect(thermostat?.tap).toEqual({ kind: 'open' });
    expect(homescreenItems([data({ kind: 'status', state: { power: 106.1 }, config: {} })])[0]?.status).toBe('106 W');
    expect(homescreenItems([data({ kind: 'status', state: { state: 'ON', power: 1 } })])[0]?.status).toBe('An');
  });

  it('leaves out kinds it cannot draw and takes the first four in server order', () => {
    const widgets = [
      data({ id: 1, kind: 'room', targetType: 'room', targetId: 3 }),
      data({ id: 2, targetId: 10 }),
      data({ id: 3, targetId: 11 }),
      data({ id: 4, targetId: 12 }),
      data({ id: 5, targetId: 13 }),
      data({ id: 6, targetId: 14 }),
    ];
    expect(homescreenItems(widgets).map((i) => i.id)).toEqual(['2', '3', '4', '5']);
    expect(homescreenItems(undefined)).toEqual([]);
  });

  it('shows what the person may no longer see as a neutral placeholder without name and tap', () => {
    const [item] = homescreenItems([{ id: 9, kind: 'switch', targetType: 'device', targetId: 7, available: false }]);
    expect(item).toMatchObject({ id: '9', placeholder: true, name: '', status: 'Nicht verfügbar' });
    expect(item?.tap).toEqual({ kind: 'none' });
  });

  it('only cuts texts from the server, never interprets them', () => {
    const [item] = homescreenItems([data({ name: '<b>' + 'x'.repeat(100), config: { deviceType: 'y'.repeat(100) } })]);
    expect(item?.name.startsWith('<b>')).toBe(true);
    expect(item?.name).toHaveLength(60);
    expect(item?.deviceType).toHaveLength(40);
  });

  it('keeps the last known tiles for offline, without state and without switching', () => {
    const items = staleItems(homescreenItems([data({}), { id: 2, kind: 'switch', targetType: 'device', targetId: 8, available: false }]));
    expect(items[0]).toMatchObject({ name: 'Stehlampe', status: 'Offline', on: false });
    expect(items[0]?.tap).toEqual({ kind: 'open' });
    expect(items[1]?.placeholder).toBe(true);
  });
});

describe('selection', () => {
  const widgets: ServerWidget[] = [
    { id: 1, kind: 'switch', targetType: 'device', targetId: 7 },
    { id: 2, kind: 'status', targetType: 'device', targetId: 7 },
    { id: 3, kind: 'room', targetType: 'room', targetId: 2 },
  ];

  it('knows which devices are on the widget and how many tiles the home screen can draw', () => {
    expect([...widgetDeviceIds(widgets)]).toEqual(['7']);
    expect(widgetsOfDevice(widgets, 7).map((w) => w.id)).toEqual([1, 2]);
    expect(homeWidgetCount(widgets)).toBe(2);
  });

  it('gives each device type a fitting kind', () => {
    expect(widgetKindFor({ type: 'light' })).toBe('switch');
    expect(widgetKindFor({ type: 'switch' })).toBe('switch');
    expect(widgetKindFor({ type: 'lock' })).toBe('lock');
    expect(widgetKindFor({ type: 'thermostat' })).toBe('thermostat');
    expect(widgetKindFor({ type: 'sensor' })).toBe('status');
  });
});

describe('taking over a selection stored on the phone', () => {
  const devices = [
    { id: 6, type: 'light' },
    { id: 5, type: 'lock' },
    { id: 4, type: 'switch' },
  ];

  it('uploads the existing devices in the stored order once the server has no widgets', () => {
    expect(widgetsToTakeOver(['6', '99', '5'], [], devices)).toEqual([
      { deviceId: 6, kind: 'switch', config: { deviceType: 'light' } },
      { deviceId: 5, kind: 'lock', config: { deviceType: 'lock' } },
    ]);
  });

  it('does nothing when the server has widgets already (another phone was first) or nothing is stored', () => {
    expect(widgetsToTakeOver(['6'], [{ id: 1, kind: 'switch', targetType: 'device', targetId: 6 }], devices)).toEqual([]);
    expect(widgetsToTakeOver([], [], devices)).toEqual([]);
    expect(widgetsToTakeOver(undefined, undefined, devices)).toEqual([]);
  });

  it('takes no duplicates and at most four', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, type: 'light' }));
    expect(widgetsToTakeOver(['1', '1', '2', '3', '4', '5', '6'], [], many).map((w) => w.deviceId)).toEqual([1, 2, 3, 4]);
  });
});

describe('resuming an interrupted takeover', () => {
  it('only creates what is not on the server yet', () => {
    const devices = [
      { id: 6, type: 'light' },
      { id: 5, type: 'lock' },
    ];
    const server: ServerWidget[] = [{ id: 1, kind: 'switch', targetType: 'device', targetId: 6 }];
    expect(widgetsStillToTakeOver(['6', '5'], server, devices).map((w) => w.deviceId)).toEqual([5]);
    expect(widgetsStillToTakeOver(['6', '5'], [...server, { id: 2, kind: 'lock', targetType: 'device', targetId: 5 }], devices)).toEqual([]);
  });
});

describe('the server limits in German', () => {
  const refused = (detail: string) => new ApiError(400, { detail } as never);

  it('translates the refusals people can run into', () => {
    expect(widgetErrorText(refused('At most 50 widgets'))).toBe('Es sind höchstens 50 Widgets möglich.');
    expect(widgetErrorText(refused('config must be at most 2048 bytes'))).toBe('Die Einstellungen des Widgets sind zu groß.');
    expect(widgetErrorText(refused('No device with id 5'))).toContain('nicht sehen');
    expect(widgetErrorText(refused('A thermostat widget does not fit a light'))).toBe('Diese Widget-Art passt nicht zu diesem Gerät.');
    expect(widgetErrorText(refused('widgetIds must contain each of your widgets exactly once'))).toContain('Reihenfolge');
  });

  it('keeps German messages of the backend and falls back for anything else', () => {
    expect(widgetErrorText(refused('Das Konto ist deaktiviert.'))).toBe('Das Konto ist deaktiviert.');
    expect(widgetErrorText(new Error('boom'))).toBe('Das hat nicht geklappt');
  });
});
