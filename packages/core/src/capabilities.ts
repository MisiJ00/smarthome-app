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

/** Readable names for the usual Zigbee2MQTT properties. */
const LABELS: Record<string, string> = {
  state: 'Ein/Aus',
  brightness: 'Helligkeit',
  color_temp: 'Farbtemperatur',
  occupied_heating_setpoint: 'Solltemperatur',
  current_heating_setpoint: 'Solltemperatur',
  local_temperature: 'Temperatur',
  system_mode: 'Modus',
  running_state: 'Heizt gerade',
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

/** Temperatures get +/- buttons, everything else with a range a slider. */
export function isTemperature(feature: Feature): boolean {
  return feature.kind === 'numeric' && (feature.unit === '°C' || feature.property.endsWith('_setpoint'));
}

export function formatValue(feature: Feature, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '–';
  }
  if (feature.kind === 'numeric' && typeof value === 'number') {
    const rounded = Math.round(value * 10) / 10;
    return feature.unit ? `${rounded.toLocaleString('de-DE')} ${feature.unit}` : rounded.toLocaleString('de-DE');
  }
  return String(value);
}
