import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import type { Device } from '@smarthome/api-client';
import { controls, formatValue, isOn, isTemperature, label, primaryAction, tileStatus, type Feature, type TileSize } from '@smarthome/core';

import { cardShadow, glowShadow, radius, space, useColors, useScheme, useVivid, withAlpha } from '../../lib/theme';
import { Stepper, ValueSlider } from '../DeviceCard';
import { Icon } from '../Icon';
import { AppText, Button, GradientFill } from '../ui';
import { tickFeedback, toggleFeedback } from './haptics';
import { readoutIcon, typeIcon, typeLabel } from './meta';
import { useDeviceSend } from './useDeviceSend';

/** How long a press must last to open the details (docs/DESIGN-V2.md, 3). */
export const LONG_PRESS_MS = 450;

/**
 * A device as small (S, half the width) or medium (M, full width) tile. Tap: the primary action (switch lights,
 * plugs and switches, otherwise the details); long press or the "⋯" (TalkBack: action "Optionen"): the details.
 * M shows the main control inline: switch and brightness, the thermostat's setpoint, or a lock's state and button.
 */
export const DeviceTile = memo(function DeviceTile({ device, size, onDetails }: { device: Device; size: Exclude<TileSize, 'l'>; onDetails: () => void }) {
  const c = useColors();
  const scheme = useScheme();
  const vivid = useVivid();
  const command = useDeviceSend(device);
  const action = primaryAction(device);
  const ctl = controls(device.type, device.capabilities);
  const state = device.state ?? {};
  const on = ctl.power ? isOn(ctl.power, state) : false;
  const locked = ctl.lock ? isOn(ctl.lock, state) : false;
  const heating = /^heat/i.test(String(state['running_state'] ?? ''));
  const status = tileStatus(device);
  const canControl = (device.permissions ?? []).some((p) => p.action === 'control');
  const lockedTap = action.kind === 'toggle' ? command.lockedFor(action.command) : undefined;
  const scale = useBounce(on);

  // On: gradient with glow (vivid) or amber tint (calm); text on the gradient in accentText
  const gradient = on && vivid;
  const fg = gradient ? c.accentText : c.text;
  // the status on the gradient in full accentText: a lighter tone could miss 4.5:1 on the light end
  const muted = gradient ? c.accentText : c.muted;

  const press = () => {
    if (action.kind !== 'toggle') {
      onDetails();
    } else if (!command.isPending) {
      if (!lockedTap) {
        toggleFeedback(!action.on);
      }
      command.send(action.command);
    }
  };
  const hint = action.kind !== 'toggle' ? 'Tippen für Optionen' : lockedTap ?? `Tippen zum ${action.on ? 'Ausschalten' : 'Einschalten'}`;

  const brightness = ctl.settings.find((f): f is Extract<Feature, { kind: 'numeric' }> => f.kind === 'numeric' && f.property === 'brightness');
  const setpoint = ctl.settings.find((f): f is Extract<Feature, { kind: 'numeric' }> => f.kind === 'numeric' && isTemperature(f));
  const iconActive = on || heating;

  return (
    <Animated.View
      style={[
        styles.tile,
        size === 's' ? styles.small : styles.medium,
        cardShadow[scheme],
        gradient && styles.lit,
        // matte until on: a hairline off the ground; calm "on" gets a rim in the on colour
        { backgroundColor: on && !vivid ? c.onSoft : c.surface, borderColor: on && !vivid ? withAlpha(c.on, 0.4) : withAlpha(c.text, 0.08) },
        scale,
        command.isPending && styles.busy,
      ]}
    >
      {gradient && (
        <>
          {/* glow in both gradient colours, like a lamp lighting the wall */}
          <View style={[StyleSheet.absoluteFill, styles.round, glowShadow(c.accent2, true)]} />
          <GradientFill style={[StyleSheet.absoluteFill, styles.round, glowShadow(c.accent, true)]} />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[device.name, status].filter(Boolean).join(', ')}
        accessibilityHint={`${hint}. Lange drücken für Optionen`}
        accessibilityActions={[{ name: 'longpress', label: 'Optionen' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onDetails()}
        onPress={press}
        onLongPress={() => {
          tickFeedback();
          onDetails();
        }}
        delayLongPress={LONG_PRESS_MS}
        style={({ pressed }) => [size === 's' ? styles.faceSmall : styles.faceMedium, pressed && styles.pressed]}
      >
        <View
          style={[
            styles.icon,
            size === 'm' && styles.iconMedium,
            gradient
              ? styles.glass
              : { backgroundColor: iconActive ? c.on : c.surface2, borderColor: 'transparent' },
          ]}
        >
          <Icon name={typeIcon(device.type, locked)} size={size === 's' ? 26 : 22} color={gradient ? c.accentText : iconActive ? '#151b28' : c.muted} />
        </View>
        <View style={styles.text}>
          <AppText weight="semibold" numberOfLines={2} color={fg} style={styles.name}>
            {device.name}
          </AppText>
          <AppText variant="small" weight="medium" color={muted} numberOfLines={1} tabular>
            {size === 'm' && ctl.lock ? typeLabel(device.type) : status || typeLabel(device.type)}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Optionen für ${device.name}`}
        onPress={onDetails}
        style={({ pressed }) => [styles.more, pressed && { backgroundColor: withAlpha(fg, 0.12) }]}
      >
        <Icon name="more" size={18} color={muted} />
      </Pressable>

      {size === 'm' && ctl.power && (
        <View style={styles.controls}>
          <View style={styles.grow}>
            {brightness && (
              <ValueSlider
                feature={brightness}
                value={typeof state[brightness.property] === 'number' ? (state[brightness.property] as number) : undefined}
                disabled={!canControl}
                on={on && !gradient}
                onSend={command.send}
              />
            )}
          </View>
          <Switch
            accessibilityLabel={`${device.name} ${on ? 'ausschalten' : 'einschalten'}`}
            value={on}
            disabled={!canControl || command.isPending || lockedTap !== undefined}
            onValueChange={(next) => {
              toggleFeedback(next);
              command.send({ [ctl.power!.property]: next ? ctl.power!.on : ctl.power!.off });
            }}
            trackColor={{ true: gradient ? withAlpha('#ffffff', 0.45) : c.on, false: c.border }}
            thumbColor="#ffffff"
          />
        </View>
      )}
      {size === 'm' && !ctl.power && setpoint && (
        <View style={styles.controls}>
          <View style={styles.grow}>
            <Stepper
              feature={setpoint}
              value={typeof state[setpoint.property] === 'number' ? (state[setpoint.property] as number) : undefined}
              disabled={!canControl}
              onSend={command.send}
            />
          </View>
        </View>
      )}
      {size === 'm' && ctl.lock && <LockRow device={device} send={command.send} pending={command.isPending} />}
      {size === 'm' && !ctl.power && !setpoint && !ctl.lock && ctl.readouts.length > 0 && (
        <View style={styles.readings}>
          {ctl.readouts.slice(0, 3).map((f) => (
            <View key={f.property} style={[styles.reading, { backgroundColor: c.surface2 }]} accessible accessibilityLabel={`${label(f.property)}: ${formatValue(f, state[f.property])}`}>
              <Icon name={readoutIcon(f.property)} size={13} color={c.muted} />
              <AppText variant="small" weight="semibold" tabular>
                {formatValue(f, state[f.property])}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
});

/** M tile of a lock: the state large, a reading (battery) and "Öffnen" (confirmed with the fingerprint) or "Abschließen". */
function LockRow({ device, send, pending }: { device: Device; send: (body: Record<string, unknown>) => void; pending: boolean }) {
  const c = useColors();
  const ctl = controls(device.type, device.capabilities);
  const lock = ctl.lock!;
  const state = device.state ?? {};
  const locked = isOn(lock, state);
  const permissions = device.permissions ?? [];
  const reading = ctl.readouts.find((f) => f.property === 'battery');
  return (
    <View style={styles.controls}>
      <View style={styles.grow}>
        <View style={styles.lockState}>
          <Icon name={locked ? 'lock' : 'unlock'} size={18} color={locked ? c.ok : c.warn} />
          <AppText variant="title" color={locked ? c.ok : c.warn}>
            {locked ? 'Abgeschlossen' : 'Offen'}
          </AppText>
        </View>
        {reading && (
          <AppText variant="small" color={c.muted} tabular>
            {label(reading.property)} {formatValue(reading, state[reading.property])}
          </AppText>
        )}
      </View>
      {locked && permissions.some((p) => p.action === 'unlock') && (
        <Button title="Öffnen" icon="unlock" kind="primary" small busy={pending} onPress={() => send({ [lock.property]: lock.off })} />
      )}
      {!locked && permissions.some((p) => p.action === 'control') && (
        <Button title="Abschließen" icon="lock" small busy={pending} onPress={() => send({ [lock.property]: lock.on })} />
      )}
    </View>
  );
}

/** A short springy nudge when the tile switches; still when the system asks for less motion. */
function useBounce(on: boolean) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      return;
    }
    scale.value = withSequence(withSpring(on ? 1.04 : 0.97, { damping: 12, stiffness: 400 }), withSpring(1, { damping: 14, stiffness: 300 }));
  }, [on, reduced, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.lg, borderWidth: 1, overflow: 'visible' },
  // the gradient covers the hairline
  lit: { borderColor: 'transparent' },
  round: { borderRadius: radius.lg },
  small: { width: '100%', aspectRatio: 1 },
  medium: { width: '100%', minHeight: 148 },
  busy: { opacity: 0.8 },
  faceSmall: { flex: 1, padding: 18, justifyContent: 'space-between', gap: space.sm },
  faceMedium: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingRight: 56 },
  pressed: { transform: [{ scale: 0.97 }] },
  icon: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconMedium: { width: 46, height: 46, borderRadius: 14 },
  // frosted glass on the gradient: white light, never mixed with the text colour
  glass: { backgroundColor: 'rgba(255, 255, 255, 0.3)', borderColor: 'rgba(255, 255, 255, 0.4)' },
  text: { gap: 3, flexShrink: 1 },
  name: { fontSize: 16, lineHeight: 20, letterSpacing: -0.2 },
  more: { position: 'absolute', top: 4, right: 4, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: 18, paddingBottom: space.lg },
  grow: { flex: 1, minWidth: 0 },
  lockState: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  readings: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
});
