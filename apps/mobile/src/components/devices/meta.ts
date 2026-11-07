import type { IconName } from '@smarthome/theme';

// Names and icons per device type, reading and mode; the same choice as the web's DeviceCard.

const TYPES: Record<string, string> = {
  light: 'Licht',
  switch: 'Schalter',
  thermostat: 'Thermostat',
  lock: 'Schloss',
  sensor: 'Sensor',
};

export function typeLabel(type: string | undefined): string {
  return TYPES[type ?? ''] ?? type ?? '';
}

const TYPE_ICONS: Record<string, IconName> = {
  light: 'light',
  switch: 'plug',
  plug: 'plug',
  thermostat: 'climate',
  sensor: 'sensor',
  cover: 'cover',
};

export function typeIcon(type: string | undefined, locked = true): IconName {
  if (type === 'lock') {
    return locked ? 'lock' : 'unlock';
  }
  return TYPE_ICONS[type ?? ''] ?? 'device';
}

const READOUT_ICONS: Record<string, IconName> = {
  temperature: 'temperature',
  local_temperature: 'temperature',
  humidity: 'humidity',
  battery: 'battery',
  power: 'power',
  energy: 'energy',
  voltage: 'energy',
  current: 'energy',
  running_state: 'heat',
  lock_state: 'lock',
  occupancy: 'motion',
  contact: 'contact',
};

export function readoutIcon(property: string): IconName {
  return READOUT_ICONS[property] ?? 'info';
}

const MODE_ICONS: Record<string, IconName> = { off: 'power', auto: 'auto', heat: 'heat', cool: 'cool', fan_only: 'fan' };

export function modeIcon(value: string): IconName | undefined {
  return MODE_ICONS[value.toLowerCase()];
}
