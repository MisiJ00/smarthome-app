import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { Discovered } from '../../lib/admin';
import { radius, space, useColors, useVivid, withAlpha } from '../../lib/theme';
import { typeIcon, typeLabel } from '../devices/meta';
import { Icon } from '../Icon';
import { AppText, Button, GradientFill, Muted } from '../ui';

/**
 * A newly found device: gradient frame with a soft halo that breathes (still when the system asks for less motion
 * or in the calm style), a "Neu" mark and the "Übernehmen" action.
 */
export function FoundCard({ device, onAdopt }: { device: Discovered; onAdopt: () => void }) {
  const c = useColors();
  const vivid = useVivid();
  const reduced = useReducedMotion();
  const still = reduced || !vivid;
  const glow = useSharedValue(still ? 0.6 : 0.25);
  useEffect(() => {
    if (still) {
      glow.value = 0.6;
      return;
    }
    glow.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(glow);
  }, [still, glow]);
  const halo = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.985 + glow.value * 0.02 }] }));

  const name = device.suggestedName || device.externalId || 'Neues Gerät';
  const meta = [device.vendor, device.model, typeLabel(device.type)].filter(Boolean).join(' · ');
  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: withAlpha(c.accent, vivid ? 0.28 : 0.18) }, halo]} />
      <GradientFill style={styles.frame}>
        <View style={[styles.inner, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <GradientFill style={styles.icon}>
              <Icon name={typeIcon(device.type)} size={24} color={c.accentText} />
            </GradientFill>
            <View style={styles.main}>
              <AppText weight="semibold" numberOfLines={2}>
                {name}
              </AppText>
              {meta !== '' && (
                <Muted small>
                  {meta}
                </Muted>
              )}
            </View>
            <GradientFill style={styles.mark}>
              <Icon name="found" size={12} color={c.accentText} />
              <AppText variant="caption" weight="semibold" color={c.accentText}>
                Neu
              </AppText>
            </GradientFill>
          </View>
          <Button title="Übernehmen" kind="primary" icon="add" onPress={onAdopt} />
        </View>
      </GradientFill>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 3 },
  halo: { ...StyleSheet.absoluteFill, borderRadius: radius.lg + 3 },
  frame: { borderRadius: radius.lg, padding: 2, overflow: 'hidden' },
  inner: { borderRadius: radius.lg - 2, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, gap: 2 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden', alignSelf: 'flex-start' },
});
