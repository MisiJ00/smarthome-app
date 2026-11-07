import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useColors, useVivid, withAlpha } from '../../lib/theme';
import { AppText } from '../ui';

/**
 * Ring in the accent gradient that empties clockwise as the time runs out, with m:ss in the middle. `progress` goes
 * from 1 (full) to 0. Vivid: gradient arc on a soft accent halo; calm: flat accent arc on a neutral track.
 */
export function CountdownRing({ progress, seconds, size = 148 }: { progress: number; seconds: number; size?: number }) {
  const c = useColors();
  const vivid = useVivid();
  const stroke = 12;
  const r = (size - stroke) / 2 - 4;
  const length = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const [from, to] = c.gradient;
  const mid = size / 2;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`noch ${minutes} Minuten ${rest} Sekunden`}
    >
      {/* start at the top: turned by a quarter */}
      <Svg width={size} height={size} style={styles.ring}>
        <Defs>
          <LinearGradient id="countdown" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={vivid ? from : c.accent} />
            <Stop offset="1" stopColor={vivid ? to : c.accent} />
          </LinearGradient>
        </Defs>
        {/* halo inside the ring, so the digits sit on a hint of the accent */}
        {vivid && <Circle cx={mid} cy={mid} r={r - stroke / 2} fill={withAlpha(from, 0.1)} />}
        <Circle cx={mid} cy={mid} r={r} stroke={withAlpha(c.text, 0.09)} strokeWidth={stroke} fill="none" />
        <Circle
          cx={mid}
          cy={mid}
          r={r}
          stroke="url(#countdown)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - p)}
        />
      </Svg>
      <View style={styles.center}>
        <AppText variant="display" tabular>
          {minutes}:{String(rest).padStart(2, '0')}
        </AppText>
        <AppText variant="caption" color={c.muted}>
          Minuten
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { transform: [{ rotate: '-90deg' }] },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
