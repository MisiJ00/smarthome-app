import { ScrollView, StyleSheet } from 'react-native';

import { space } from '../../lib/theme';
import { Chip } from '../ui';
import { tickFeedback } from './haptics';

export interface RoomChip {
  key: string;
  label: string;
  /** Number of devices, shown after the name like on the web ("Wohnzimmer 3"). */
  count?: number;
}

/** "Alle" and one chip per room, horizontally scrollable; `selected` null is "Alle". */
export function RoomChips({ chips, selected, onSelect }: { chips: RoomChip[]; selected: string | null; onSelect: (key: string | null) => void }) {
  const all: Array<RoomChip & { value: string | null }> = [{ key: 'all', label: 'Alle', value: null }, ...chips.map((chip) => ({ ...chip, value: chip.key }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel="Räume">
      {all.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.count !== undefined ? `${chip.label} ${chip.count}` : chip.label}
          selected={selected === chip.value}
          onPress={() => {
            if (selected !== chip.value) {
              tickFeedback();
              onSelect(chip.value);
            }
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.lg },
});
