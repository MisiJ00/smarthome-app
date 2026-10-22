import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError, type Device } from '@smarthome/api-client';
import { controls, formatValue, isOn, isTemperature, label, type Feature } from '@smarthome/core';

import { useCommand } from '../lib/api';
import { useColors } from '../lib/theme';
import { Button, Card, useToast } from './ui';

/** One device with the controls its capabilities and the user's permissions allow (same logic as the web). */
export function DeviceCard({ device }: { device: Device }) {
  const c = useColors();
  const command = useCommand();
  const toast = useToast();
  const state = device.state ?? {};
  const ctl = controls(device.type, device.capabilities);
  const permissions = new Map((device.permissions ?? []).map((p) => [p.action, p]));
  const canControl = permissions.has('control');
  const unlock = permissions.get('unlock');
  const on = ctl.power ? isOn(ctl.power, state) : false;
  const locked = ctl.lock ? isOn(ctl.lock, state) : false;

  const send = (body: Record<string, unknown>) => {
    if (device.id === undefined) {
      return;
    }
    command.mutate(
      { deviceId: device.id, command: body },
      {
        onSuccess: (result) => {
          if (result.status === 'confirmation_required') {
            toast('info', `${device.name}: wartet auf Freigabe`);
          }
        },
        onError: (error) => toast('error', error instanceof ApiError ? error.message : 'Befehl fehlgeschlagen'),
      },
    );
  };

  return (
    <Card highlight={on ? c.on : undefined}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <Text style={[styles.name, { color: c.text }]}>{device.name}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{TYPES[device.type ?? ''] ?? device.type}</Text>
        </View>
        {ctl.power && (
          <Switch
            accessibilityLabel={`${device.name} ${on ? 'ausschalten' : 'einschalten'}`}
            value={on}
            disabled={!canControl || command.isPending}
            onValueChange={(next) => send({ [ctl.power!.property]: next ? ctl.power!.on : ctl.power!.off })}
            trackColor={{ true: c.on, false: c.surface2 }}
          />
        )}
      </View>

      {ctl.lock && (
        <View style={styles.gap}>
          <Text style={{ color: locked ? c.ok : c.warn, fontWeight: '600' }}>{locked ? 'Abgeschlossen' : 'Offen'}</Text>
          <View style={styles.row}>
            {canControl && <Button title="Abschließen" disabled={locked} busy={command.isPending} onPress={() => send({ [ctl.lock!.property]: ctl.lock!.on })} />}
            {unlock && (
              <Button
                title={unlock.requiresConfirmation ? 'Öffnen anfragen' : 'Öffnen'}
                kind="primary"
                disabled={!locked}
                busy={command.isPending}
                onPress={() => send({ [ctl.lock!.property]: ctl.lock!.off })}
              />
            )}
          </View>
        </View>
      )}

      {ctl.settings.map((feature) => (
        <Setting key={feature.property} feature={feature} value={state[feature.property]} disabled={!canControl} onSend={send} />
      ))}

      {ctl.readouts.length > 0 && (
        <View style={styles.readouts}>
          {ctl.readouts.map((feature) => (
            <View key={feature.property} style={[styles.readout, { backgroundColor: c.surface2 }]}>
              <Text style={{ color: c.muted, fontSize: 12 }}>{label(feature.property)}</Text>
              <Text style={{ color: c.text, fontWeight: '600' }}>{formatValue(feature, state[feature.property])}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function Setting({ feature, value, disabled, onSend }: { feature: Feature; value: unknown; disabled: boolean; onSend: (body: Record<string, unknown>) => void }) {
  const c = useColors();
  if (feature.kind === 'numeric' && isTemperature(feature)) {
    return <Stepper feature={feature} value={typeof value === 'number' ? value : undefined} disabled={disabled} onSend={onSend} />;
  }
  if (feature.kind === 'numeric') {
    const min = feature.min ?? 0;
    const max = feature.max ?? 100;
    const current = typeof value === 'number' ? value : min;
    return (
      <View>
        <View style={styles.between}>
          <Text style={{ color: c.muted }}>{label(feature.property)}</Text>
          <Text style={{ color: c.text }}>
            {feature.property === 'brightness' ? `${Math.round(((current - min) / (max - min)) * 100)} %` : formatValue(feature, current)}
          </Text>
        </View>
        <Slider
          accessibilityLabel={label(feature.property)}
          minimumValue={min}
          maximumValue={max}
          step={feature.step ?? 1}
          value={current}
          disabled={disabled}
          minimumTrackTintColor={c.accent}
          thumbTintColor={c.accent}
          // Sends once the finger lets go, not for every step
          onSlidingComplete={(next) => onSend({ [feature.property]: Math.round(next) })}
        />
      </View>
    );
  }
  if (feature.kind === 'enum') {
    return (
      <View style={styles.gap}>
        <Text style={{ color: c.muted }}>{label(feature.property)}</Text>
        <View style={styles.row}>
          {feature.values.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityState={{ selected: value === v, disabled }}
              disabled={disabled}
              onPress={() => onSend({ [feature.property]: v })}
              style={[styles.chip, { borderColor: value === v ? c.accent : c.border, backgroundColor: value === v ? c.surface2 : c.surface }]}
            >
              <Text style={{ color: c.text }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  if (feature.kind === 'binary') {
    return (
      <View style={styles.between}>
        <Text style={{ color: c.muted }}>{label(feature.property)}</Text>
        <Switch value={value === feature.on} disabled={disabled} onValueChange={(next) => onSend({ [feature.property]: next ? feature.on : feature.off })} />
      </View>
    );
  }
  return null;
}

/** +/- in half degrees; sends after a short pause, so several taps become one command. */
function Stepper({ feature, value, disabled, onSend }: { feature: Extract<Feature, { kind: 'numeric' }>; value: number | undefined; disabled: boolean; onSend: (body: Record<string, unknown>) => void }) {
  const c = useColors();
  const [draft, setDraft] = useState<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shown = draft ?? value;
  const step = feature.step ?? 0.5;
  const change = (delta: number) => {
    const next = Math.min(feature.max ?? 35, Math.max(feature.min ?? 0, Math.round(((shown ?? 20) + delta) / step) * step));
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSend({ [feature.property]: next });
      setTimeout(() => setDraft(undefined), 2500);
    }, 600);
  };
  return (
    <View style={styles.between}>
      <Text style={{ color: c.muted }}>{label(feature.property)}</Text>
      <View style={styles.row}>
        <Button title="−" disabled={disabled} onPress={() => change(-step)} />
        <Text style={[styles.setpoint, { color: c.text }]}>{formatValue(feature, shown)}</Text>
        <Button title="+" disabled={disabled} onPress={() => change(step)} />
      </View>
    </View>
  );
}

const TYPES: Record<string, string> = { light: 'Licht', switch: 'Schalter', thermostat: 'Thermostat', lock: 'Schloss', sensor: 'Sensor' };

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  gap: { gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readouts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  readout: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  setpoint: { minWidth: 70, textAlign: 'center', fontSize: 18, fontWeight: '600' },
});
