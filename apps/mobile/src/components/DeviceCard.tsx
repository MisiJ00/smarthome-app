import Slider from '@react-native-community/slider';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import type { Device } from '@smarthome/api-client';
import {
  actionLabel,
  colorTempHint,
  controls,
  formatValue,
  isColorTemp,
  isOn,
  isTemperature,
  label,
  miredToKelvin,
  optionLabel,
  type Feature,
} from '@smarthome/core';

import { colors } from '@smarthome/theme';

import { radius, space, useColors, withAlpha } from '../lib/theme';
import { tickFeedback, toggleFeedback } from './devices/haptics';
import { modeIcon, readoutIcon, typeIcon, typeLabel } from './devices/meta';
import { Segmented } from './devices/Segmented';
import { useDeviceSend } from './devices/useDeviceSend';
import { Icon } from './Icon';
import { AppText, Badge, Button, Card, IconCircle } from './ui';

/** How long a value the user just set is shown before the device's reported value takes over again. */
const DRAFT_MS = 2500;

/** Icon colour on the solid amber circle: amber is light in both modes, so always the dark text colour (contrast). */
const ON_FOREGROUND = colors.light.text;

/**
 * One device with the controls its capabilities and the user's permissions allow (same logic as the web). Memoised:
 * a live update of one device re-renders only its card (the list keeps the other device objects).
 */
export const DeviceCard = memo(function DeviceCard({ device, variant = 'card' }: { device: Device; variant?: 'card' | 'sheet' }) {
  const c = useColors();
  const command = useDeviceSend(device);
  const state = device.state ?? {};
  const ctl = useMemo(() => controls(device.type, device.capabilities), [device.type, device.capabilities]);
  const permissions = useMemo(() => new Map((device.permissions ?? []).map((p) => [p.action, p])), [device.permissions]);
  const canControl = permissions.has('control');
  const unlock = permissions.get('unlock');
  const on = ctl.power ? isOn(ctl.power, state) : false;
  const locked = ctl.lock ? isOn(ctl.lock, state) : false;
  const heating = /^heat/i.test(String(state['running_state'] ?? ''));
  // In the detail sheet the head is just a title (a tap there must not switch)
  const canSwitch = variant === 'card' && Boolean(ctl.power) && canControl && !command.isPending;
  const lockedActions = device.lockedActions ?? [];

  const send = command.send;
  // The switch is greyed out when its next step is locked by an admin; the reason is shown below the head
  const nextLocked = ctl.power ? command.lockedFor({ [ctl.power.property]: on ? ctl.power.off : ctl.power.on }) : undefined;
  const toggle = (next: boolean) => {
    toggleFeedback(next);
    send({ [ctl.power!.property]: next ? ctl.power!.on : ctl.power!.off });
  };

  return (
    <Frame sheet={variant === 'sheet'} on={on} busy={command.isPending}>
      <View style={styles.head}>
        {/* The whole head switches, like the switch itself */}
        <Pressable disabled={!canSwitch} onPress={() => toggle(!on)} accessible={false} style={({ pressed }) => [styles.headMain, pressed && styles.pressed]}>
          {on || heating ? (
            // Solid amber circle: a tinted one (IconCircle tone "on") would vanish on the tinted card
            <View style={[styles.iconActive, { backgroundColor: c.on }]}>
              <Icon name={typeIcon(device.type, locked)} size={22} color={ON_FOREGROUND} />
            </View>
          ) : (
            <IconCircle icon={typeIcon(device.type, locked)} tone={ctl.lock && locked ? 'ok' : 'neutral'} size={44} />
          )}
          <View style={styles.grow}>
            <AppText weight="semibold" numberOfLines={2}>
              {device.name}
            </AppText>
            <AppText variant="small" color={c.muted}>
              {typeLabel(device.type)}
              {ctl.power ? ` · ${on ? 'An' : 'Aus'}` : ''}
            </AppText>
          </View>
        </Pressable>
        {lockedActions.length > 0 && (
          <View accessible accessibilityLabel={`Gesperrt: ${lockedActions.map(actionLabel).join(', ')}`}>
            <IconCircle icon="lock" tone="warn" size={28} />
          </View>
        )}
        {ctl.power && (
          <Switch
            accessibilityLabel={`${device.name} ${on ? 'ausschalten' : 'einschalten'}`}
            value={on}
            disabled={!canControl || command.isPending || nextLocked !== undefined}
            onValueChange={toggle}
            trackColor={{ true: c.on, false: c.border }}
            thumbColor="#ffffff"
            ios_backgroundColor={c.border}
          />
        )}
      </View>

      {nextLocked && (
        <Badge tone="warn" icon="lock" label={nextLocked} />
      )}

      {ctl.lock && (
        <View style={styles.gap}>
          <Badge tone={locked ? 'ok' : 'warn'} icon={locked ? 'lock' : 'unlock'} label={locked ? 'Abgeschlossen' : 'Offen'} />
          <View style={styles.buttons}>
            {canControl && (
              <View style={styles.buttonCell}>
                <Button
                  title="Abschließen"
                  icon="lock"
                  disabled={locked}
                  busy={command.isPending}
                  onPress={() => {
                    toggleFeedback(true);
                    send({ [ctl.lock!.property]: ctl.lock!.on });
                  }}
                />
              </View>
            )}
            {unlock && (
              <View style={styles.buttonCell}>
                <Button
                  // with approval the person confirms themselves (fingerprint), see devices/ConfirmAction
                  title="Öffnen"
                  icon={unlock.requiresConfirmation ? 'approval' : 'unlock'}
                  kind="primary"
                  disabled={!locked}
                  busy={command.isPending}
                  onPress={() => {
                    toggleFeedback(false);
                    send({ [ctl.lock!.property]: ctl.lock!.off });
                  }}
                />
              </View>
            )}
          </View>
        </View>
      )}

      {ctl.settings.map((feature) => (
        <Setting key={feature.property} feature={feature} value={state[feature.property]} disabled={!canControl} on={on} onSend={send} />
      ))}

      {ctl.readouts.length > 0 && (
        <View style={styles.readouts}>
          {ctl.readouts.map((feature) => (
            <View key={feature.property} style={[styles.readout, { backgroundColor: on ? c.surface : c.surface2 }]}>
              <View style={styles.readoutLabel}>
                <Icon name={readoutIcon(feature.property)} size={13} color={c.muted} />
                <AppText variant="caption" color={c.muted} numberOfLines={1}>
                  {label(feature.property)}
                </AppText>
              </View>
              <AppText weight="semibold" tabular>
                {formatValue(feature, state[feature.property])}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Frame>
  );
});

/** The card around the controls; in the detail sheet just a column (the sheet is the surface). */
function Frame({ sheet, on, busy, children }: { sheet: boolean; on: boolean; busy: boolean; children: ReactNode }) {
  const c = useColors();
  if (sheet) {
    return <View style={[styles.card, busy && styles.busy]}>{children}</View>;
  }
  return (
    // Switched on: amber tinted surface with a tinted edge, like the web's .device-on
    <Card tint={on ? c.onSoft : undefined} highlight={on ? withAlpha(c.on, 0.35) : undefined} style={[styles.card, busy && styles.busy]}>
      {children}
    </Card>
  );
}

function Setting({
  feature,
  value,
  disabled,
  on,
  onSend,
}: {
  feature: Feature;
  value: unknown;
  disabled: boolean;
  on: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const c = useColors();
  if (feature.kind === 'numeric' && isTemperature(feature)) {
    return <Stepper feature={feature} value={typeof value === 'number' ? value : undefined} disabled={disabled} onSend={onSend} />;
  }
  if (feature.kind === 'numeric') {
    return <ValueSlider feature={feature} value={typeof value === 'number' ? value : undefined} disabled={disabled} on={on} onSend={onSend} />;
  }
  if (feature.kind === 'enum') {
    return (
      <View style={styles.gap}>
        <AppText variant="small" color={c.muted}>
          {label(feature.property)}
        </AppText>
        <Segmented
          label={label(feature.property)}
          segments={feature.values.map((v) => ({ value: v, label: optionLabel(feature.property, v), icon: modeIcon(v) }))}
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(v) => {
            tickFeedback();
            onSend({ [feature.property]: v });
          }}
        />
      </View>
    );
  }
  if (feature.kind === 'binary') {
    return (
      <View style={styles.between}>
        <AppText variant="small" color={c.muted}>
          {label(feature.property)}
        </AppText>
        <Switch
          accessibilityLabel={label(feature.property)}
          value={value === feature.on}
          disabled={disabled}
          onValueChange={(next) => {
            toggleFeedback(next);
            onSend({ [feature.property]: next ? feature.on : feature.off });
          }}
          trackColor={{ true: c.accent, false: c.border }}
          thumbColor="#ffffff"
        />
      </View>
    );
  }
  return null;
}

/**
 * Brightness, colour temperature and the like. The value shown follows the finger; the command is sent once the
 * finger lets go, not for every step.
 */
export function ValueSlider({
  feature,
  value,
  disabled,
  on,
  onSend,
}: {
  feature: Extract<Feature, { kind: 'numeric' }>;
  value: number | undefined;
  disabled: boolean;
  on: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const c = useColors();
  const min = feature.min ?? 0;
  const max = feature.max ?? 100;
  const current = value ?? min;
  const [draft, setDraft] = useState<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shown = draft ?? value;
  const colorTemp = isColorTemp(feature);
  // Colour temperature without a reported value shows "–", not "0 K"
  const kelvin = colorTemp && shown !== undefined && shown > 0 ? miredToKelvin(shown) : undefined;
  const text =
    feature.property === 'brightness'
      ? `${max > min ? Math.round((((shown ?? min) - min) / (max - min)) * 100) : 100} %`
      : formatValue(feature, colorTemp ? shown : (shown ?? min));
  const tint = on ? c.on : c.accent;
  return (
    <View>
      <View style={styles.between}>
        <AppText variant="small" color={c.muted}>
          {label(feature.property)}
        </AppText>
        <AppText variant="small" weight="semibold" tabular>
          {text}
          {kelvin !== undefined && (
            <AppText variant="small" color={c.muted}>
              {' '}
              · {colorTempHint(kelvin)}
            </AppText>
          )}
        </AppText>
      </View>
      <Slider
        accessibilityLabel={label(feature.property)}
        minimumValue={min}
        maximumValue={max}
        step={feature.step ?? 1}
        value={current}
        disabled={disabled}
        // More mired is warmer: warm on the left, cold on the right, as people expect
        inverted={colorTemp}
        minimumTrackTintColor={colorTemp ? '#ffb35c' : tint}
        maximumTrackTintColor={colorTemp ? '#a9cbff' : c.border}
        thumbTintColor={colorTemp ? '#f5a13d' : tint}
        onValueChange={(next) => {
          clearTimeout(timer.current);
          setDraft(next);
        }}
        onSlidingComplete={(next) => {
          tickFeedback();
          onSend({ [feature.property]: Math.round(next) });
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDraft(undefined), DRAFT_MS);
        }}
        style={styles.slider}
      />
      {colorTemp && (
        <View style={styles.between} importantForAccessibility="no-hide-descendants">
          <AppText variant="caption" color={c.muted}>
            warm
          </AppText>
          <AppText variant="caption" color={c.muted}>
            kalt
          </AppText>
        </View>
      )}
    </View>
  );
}

/** +/- in half degrees; sends after a short pause, so several taps become one command. */
export function Stepper({
  feature,
  value,
  disabled,
  onSend,
}: {
  feature: Extract<Feature, { kind: 'numeric' }>;
  value: number | undefined;
  disabled: boolean;
  onSend: (body: Record<string, unknown>) => void;
}) {
  const c = useColors();
  const [draft, setDraft] = useState<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shown = draft ?? value;
  const step = feature.step ?? 0.5;
  const change = (delta: number) => {
    tickFeedback();
    const next = Math.min(feature.max ?? 35, Math.max(feature.min ?? 0, Math.round(((shown ?? 20) + delta) / step) * step));
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSend({ [feature.property]: next });
      setTimeout(() => setDraft(undefined), DRAFT_MS);
    }, 600);
  };
  return (
    <View style={styles.setpoint}>
      <AppText variant="small" color={c.muted}>
        {label(feature.property)}
      </AppText>
      <View style={styles.stepper}>
        <RoundButton icon="minus" label="Kälter" disabled={disabled} onPress={() => change(-step)} />
        <AppText weight="bold" tabular accessibilityLiveRegion="polite" style={styles.setpointValue}>
          {formatValue(feature, shown)}
        </AppText>
        <RoundButton icon="plus" label="Wärmer" disabled={disabled} onPress={() => change(step)} />
      </View>
    </View>
  );
}

/** Round −/+ on a soft grey disc (IconButton would bring a border); tinted with the accent while pressed. */
function RoundButton({ icon, label, disabled, onPress }: { icon: 'minus' | 'plus'; label: string; disabled: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: pressed ? c.accentSoft : c.surface2 },
        disabled && styles.disabled,
        pressed && styles.roundPressed,
      ]}
    >
      <Icon name={icon} size={22} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  busy: { opacity: 0.75 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 },
  pressed: { opacity: 0.7 },
  iconActive: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0 },
  gap: { gap: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  buttonCell: { flexGrow: 1, flexBasis: 140 },
  slider: { height: 40, marginHorizontal: -space.sm },
  readouts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  readout: { flexGrow: 1, flexBasis: '40%', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  readoutLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  setpoint: { alignItems: 'center', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  setpointValue: { minWidth: 130, textAlign: 'center', fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  roundPressed: { transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.5 },
});
