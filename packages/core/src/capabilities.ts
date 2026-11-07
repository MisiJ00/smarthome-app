// Turns a device's capabilities (Zigbee2MQTT "exposes", see the backend's z2m adapter) into controls.
// Kept generic so that real devices work without a special case per model.

/** Access bits of Zigbee2MQTT exposes. */
const PUBLISHED = 1;
const SET = 2;

interface ExposeBase {
  type: string;
  name?: string;
  property?: string;
  access?: number;
  unit?: string;
  features?: Expose[];
}

interface Expose extends ExposeBase {
  value_on?: unknown;
  value_off?: unknown;
  value_min?: number;
  value_max?: number;
  value_step?: number;
  values?: string[];
}

export type Feature =
  | { kind: 'binary'; property: string; settable: boolean; on: unknown; off: unknown; unit?: string }
  | { kind: 'numeric'; property: string; settable: boolean; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'enum'; property: string; settable: boolean; values: string[] }
  | { kind: 'text'; property: string; settable: boolean };

/** What the interface offers for one device. */
export interface Controls {
  /** The main on/off switch (lights, switches). */
  power?: Extract<Feature, { kind: 'binary' }>;
  /** Lock/unlock (locks). */
  lock?: Extract<Feature, { kind: 'binary' }>;
  /** Further settable values: brightness, setpoint, mode, ... */
  settings: Feature[];
  /** Values that can only be read: temperature, power, battery, ... */
  readouts: Feature[];
}

/** Not interesting for people. */
const HIDDEN = new Set(['linkquality']);

/** Flattens composite exposes ("light", "switch", "climate", "lock") into their features. */
export function features(capabilities: Record<string, unknown> | undefined): Feature[] {
  const exposes = Array.isArray(capabilities?.['exposes']) ? (capabilities['exposes'] as Expose[]) : [];
  const result: Feature[] = [];
  const visit = (expose: Expose) => {
    if (Array.isArray(expose.features)) {
      expose.features.forEach(visit);
      return;
    }
    const property = expose.property ?? expose.name;
    if (!property || HIDDEN.has(property)) {
      return;
    }
    const access = expose.access ?? PUBLISHED;
    const settable = (access & SET) !== 0;
    const unit = expose.unit;
    switch (expose.type) {
      case 'binary':
        result.push({ kind: 'binary', property, settable, on: expose.value_on, off: expose.value_off, ...(unit ? { unit } : {}) });
        break;
      case 'numeric':
        result.push({
          kind: 'numeric',
          property,
          settable,
          ...(expose.value_min !== undefined ? { min: expose.value_min } : {}),
          ...(expose.value_max !== undefined ? { max: expose.value_max } : {}),
          ...(expose.value_step !== undefined ? { step: expose.value_step } : {}),
          ...(unit ? { unit } : {}),
        });
        break;
      case 'enum':
        result.push({ kind: 'enum', property, settable, values: expose.values ?? [] });
        break;
      default:
        result.push({ kind: 'text', property, settable });
    }
  };
  exposes.forEach(visit);
  return result;
}

export function controls(type: string | undefined, capabilities: Record<string, unknown> | undefined): Controls {
  const all = features(capabilities);
  const state = all.find((f): f is Extract<Feature, { kind: 'binary' }> => f.kind === 'binary' && f.property === 'state' && f.settable);
  const isLock = type === 'lock';
  const result: Controls = { settings: [], readouts: [] };
  if (state) {
    if (isLock) {
      result.lock = state;
    } else {
      result.power = state;
    }
  }
  for (const feature of all) {
    if (feature === state) {
      continue;
    }
    (feature.settable ? result.settings : result.readouts).push(feature);
  }
  return result;
}

/** Whether a binary feature is currently "on" (or locked). */
export function isOn(feature: Extract<Feature, { kind: 'binary' }>, state: Record<string, unknown> | undefined): boolean {
  return state?.[feature.property] === feature.on;
}

/** What a device needs for the helpers below; Device of the api client fits. */
interface DeviceLike {
  type?: string;
  capabilities?: Record<string, unknown>;
  state?: Record<string, unknown>;
}

/** Whether a device with a power switch (lamp, plug) is switched on. */
export function isDeviceOn(device: DeviceLike): boolean {
  const power = controls(device.type, device.capabilities).power;
  return power ? isOn(power, device.state) : false;
}

/** The temperature a device reports (thermostat or sensor), formatted like "20,8 °C". */
export function deviceTemperature(device: DeviceLike): string | undefined {
  const reading = controls(device.type, device.capabilities).readouts.find((f) => f.property === 'local_temperature' || f.property === 'temperature');
  const value = reading ? device.state?.[reading.property] : undefined;
  return reading && typeof value === 'number' ? formatValue(reading, value) : undefined;
}

/** Readable names for the usual Zigbee2MQTT properties. */
const LABELS: Record<string, string> = {
  state: 'Ein/Aus',
  brightness: 'Helligkeit',
  color_temp: 'Farbtemperatur',
  occupied_heating_setpoint: 'Solltemperatur',
  current_heating_setpoint: 'Solltemperatur',
  local_temperature: 'Temperatur',
  system_mode: 'Modus',
  running_state: 'Zustand',
  lock_state: 'Schloss',
  battery: 'Batterie',
  power: 'Leistung',
  energy: 'Verbrauch',
  voltage: 'Spannung',
  current: 'Strom',
  temperature: 'Temperatur',
  humidity: 'Luftfeuchte',
};

export function label(property: string): string {
  return LABELS[property] ?? property.replaceAll('_', ' ');
}

/** Readable names of the actions the backend checks (permissions, locked actions, audit log). */
const ACTION_LABELS: Record<string, string> = {
  switch_on: 'Einschalten',
  switch_off: 'Ausschalten',
  lock: 'Abschließen',
  unlock: 'Aufschließen',
  view: 'Sehen',
  control: 'Schalten',
  configure: 'Einrichten',
};

/** e.g. "switch_on" → "Einschalten", "set_brightness" → "Helligkeit setzen". */
export function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) {
    return ACTION_LABELS[action];
  }
  const property = action.replace(/^set_/, '');
  return `${LABELS[property] ?? property.replaceAll('_', ' ')} setzen`;
}

/** Temperatures get +/- buttons, everything else with a range a slider. */
export function isTemperature(feature: Feature): boolean {
  return feature.kind === 'numeric' && (feature.unit === '°C' || feature.property.endsWith('_setpoint'));
}

/**
 * Readable German names for the raw values of enums (modes, states), the same in web and app. Some values mean
 * something else depending on the property: "heat" as a mode is "Heizen", as running state "Heizt".
 */
const OPTION_LABELS: Record<string, Record<string, string>> = {
  running_state: { heat: 'Heizt', heating: 'Heizt', cool: 'Kühlt', cooling: 'Kühlt', idle: 'Inaktiv', fan_only: 'Lüftet' },
  lock_state: { locked: 'Abgeschlossen', unlocked: 'Offen', not_fully_locked: 'Nicht ganz zu' },
};

const COMMON_OPTIONS: Record<string, string> = {
  off: 'Aus',
  on: 'An',
  auto: 'Automatik',
  heat: 'Heizen',
  cool: 'Kühlen',
  heating: 'Heizt',
  cooling: 'Kühlt',
  idle: 'Inaktiv',
  fan_only: 'Lüften',
  dry: 'Entfeuchten',
  emergency_heating: 'Notheizung',
  manual: 'Manuell',
  eco: 'Eco',
  comfort: 'Komfort',
  boost: 'Boost',
  away: 'Abwesend',
};

/** The readable name of one value of an enum, e.g. optionLabel('system_mode', 'heat') → "Heizen". */
export function optionLabel(property: string, value: string): string {
  return knownOption(property, value) ?? value.replaceAll('_', ' ');
}

function knownOption(property: string, value: string): string | undefined {
  const key = value.toLowerCase();
  return OPTION_LABELS[property]?.[key] ?? COMMON_OPTIONS[key];
}

/** Colour temperature: Zigbee speaks mired, people Kelvin (1 000 000 / mired, rounded to 50 K). */
export function isColorTemp(feature: Feature): boolean {
  return feature.kind === 'numeric' && (feature.property === 'color_temp' || feature.property.startsWith('color_temp_') || feature.unit === 'mired');
}

export function miredToKelvin(mired: number): number {
  return mired > 0 ? Math.round(1_000_000 / mired / 50) * 50 : 0;
}

/** How a colour temperature in Kelvin looks: warm (candle, bulb), neutral, or cold (daylight). */
export function colorTempHint(kelvin: number): 'warm' | 'neutral' | 'kalt' {
  if (kelvin < 3300) {
    return 'warm';
  }
  return kelvin < 5000 ? 'neutral' : 'kalt';
}

export function formatValue(feature: Feature, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '–';
  }
  if (isColorTemp(feature) && typeof value === 'number') {
    // 0 or less is no colour temperature (not reported yet), not 0 K
    return value > 0 ? `${miredToKelvin(value).toLocaleString('de-DE')} K` : '–';
  }
  if (feature.kind === 'numeric' && typeof value === 'number') {
    const rounded = Math.round(value * 10) / 10;
    return feature.unit ? `${rounded.toLocaleString('de-DE')} ${feature.unit}` : rounded.toLocaleString('de-DE');
  }
  if (feature.kind === 'binary') {
    if (value === feature.on || value === true) {
      return feature.property === 'state' ? 'An' : 'Ja';
    }
    if (value === feature.off || value === false) {
      return feature.property === 'state' ? 'Aus' : 'Nein';
    }
  }
  if (feature.kind === 'enum' && typeof value === 'string') {
    return optionLabel(feature.property, value);
  }
  if (feature.kind === 'text' && typeof value === 'string') {
    // free text stays as it is, only well-known state words are translated
    return knownOption(feature.property, value) ?? value;
  }
  return String(value);
}

/** The words around a command that the person confirms themselves ("Wirklich öffnen?"), the same in web and app. */
export interface CommandIntent {
  /** The permission the backend checks for this command. */
  action: 'unlock' | 'control';
  /** Whether the backend will ask for an approval (the permission says "mit Freigabe"). */
  requiresConfirmation: boolean;
  /** "Wirklich öffnen?" */
  question: string;
  /** Text of the confirming button: "Öffnen". */
  verb: string;
  /** For the toast afterwards: "Tür geöffnet". */
  done: string;
  /** Set when an admin locked this action for the device ("Ausschalten ist gesperrt"): the backend would refuse it. */
  locked?: string;
}

interface CommandDevice {
  type?: string;
  name?: string;
  capabilities?: Record<string, unknown>;
  permissions?: Array<{ action?: string; requiresConfirmation?: boolean }>;
  lockedActions?: string[];
}

/** The actions the backend's CommandGuard checks for a command (switch_on, unlock, set_brightness, ...). */
export function guardedActions(device: CommandDevice, body: Record<string, unknown>): string[] {
  const c = controls(device.type, device.capabilities);
  const binary = c.lock ?? c.power;
  return Object.keys(body).map((property) => {
    if (binary && property === binary.property) {
      const on = body[property] === binary.on;
      return c.lock ? (on ? 'lock' : 'unlock') : on ? 'switch_on' : 'switch_off';
    }
    return `set_${property}`;
  });
}

/** Why a command would be refused because an admin locked it, e.g. "Ausschalten ist gesperrt"; undefined if not. */
export function lockedReason(device: CommandDevice, body: Record<string, unknown>): string | undefined {
  const locked = new Set(device.lockedActions ?? []);
  const action = guardedActions(device, body).find((a) => locked.has(a));
  return action ? `${actionLabel(action)} ist gesperrt` : undefined;
}

/** What a command to a device means: which permission, whether it needs an approval, how to ask, whether it is locked. */
export function commandIntent(device: CommandDevice, body: Record<string, unknown>): CommandIntent {
  const c = controls(device.type, device.capabilities);
  const name = device.name ?? 'Gerät';
  const needs = (action: string) => (device.permissions ?? []).some((p) => p.action === action && p.requiresConfirmation === true);
  const locked = lockedReason(device, body);
  const extra = locked ? { locked } : {};
  if (c.lock && body[c.lock.property] === c.lock.off) {
    return { action: 'unlock', requiresConfirmation: needs('unlock'), question: 'Wirklich öffnen?', verb: 'Öffnen', done: 'Tür geöffnet', ...extra };
  }
  if (c.lock && body[c.lock.property] === c.lock.on) {
    return { action: 'control', requiresConfirmation: needs('control'), question: 'Wirklich abschließen?', verb: 'Abschließen', done: `${name} abgeschlossen`, ...extra };
  }
  if (c.power && c.power.property in body && Object.keys(body).length === 1) {
    const on = body[c.power.property] === c.power.on;
    return {
      action: 'control',
      requiresConfirmation: needs('control'),
      question: on ? 'Wirklich einschalten?' : 'Wirklich ausschalten?',
      verb: on ? 'Einschalten' : 'Ausschalten',
      done: `${name} ${on ? 'eingeschaltet' : 'ausgeschaltet'}`,
      ...extra,
    };
  }
  return { action: 'control', requiresConfirmation: needs('control'), question: 'Wirklich ändern?', verb: 'Ändern', done: `${name} geändert`, ...extra };
}
