import { StyleSheet, View } from 'react-native';

import type { Room } from '@smarthome/api-client';
import { sortRooms } from '@smarthome/core';

import { space } from '../../lib/theme';
import { AppText, Chip } from '../ui';

/** Choice of the room as chips ("Ohne Raum" first); `value` is the room id, null for none. */
export function RoomPick({ rooms, value, onChange }: { rooms: Room[]; value: number | null; onChange: (id: number | null) => void }) {
  return (
    <View style={styles.box}>
      <AppText variant="small" weight="medium">
        Raum
      </AppText>
      <View style={styles.chips}>
        <Chip label="Ohne Raum" selected={value === null} onPress={() => onChange(null)} />
        {sortRooms(rooms).map((room) => (
          <Chip key={room.id} label={room.name ?? ''} selected={value === room.id} onPress={() => onChange(room.id ?? null)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
