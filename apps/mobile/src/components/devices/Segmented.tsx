import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '@smarthome/theme';

import { radius, space, useColors } from '../../lib/theme';
import { Icon } from '../Icon';
import { AppText } from '../ui';

export interface Segment {
  value: string;
  label: string;
  icon?: IconName;
}

/** A row of mutually exclusive choices (thermostat mode); wraps into a second line when they do not fit. */
export function Segmented({
  label,
  segments,
  value,
  disabled,
  onChange,
}: {
  label: string;
  segments: Segment[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const c = useColors();
  return (
    <View accessibilityLabel={label} style={[styles.track, { backgroundColor: c.surface2 }]}>
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${s.label}`}
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => !active && onChange(s.value)}
            style={({ pressed }) => [
              styles.segment,
              active && [styles.active, { backgroundColor: c.surface }],
              pressed && !active && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            {s.icon && <Icon name={s.icon} size={15} color={active ? c.text : c.muted} />}
            <AppText variant="small" weight="semibold" numberOfLines={1} color={active ? c.text : c.muted}>
              {s.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 3, borderRadius: radius.md },
  segment: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2,
    minHeight: 38,
    paddingHorizontal: space.sm,
    borderRadius: radius.md - 3,
  },
  active: { boxShadow: '0 1px 3px rgba(16, 24, 40, 0.12)' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
