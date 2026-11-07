import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { raisedShadow, radius, space, useColors, useScheme, withAlpha } from '../../lib/theme';
import { Icon } from '../Icon';
import { AppText, IconCircle } from '../ui';

/** "+" in the home header (admins only): a short menu with "Gerät hinzufügen" and "Raum hinzufügen". */
export function AddMenu() {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const go = (href: '/admin/devices' | '/admin/rooms?new=1') => {
    setOpen(false);
    router.push(href);
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hinzufügen"
        accessibilityState={{ expanded: open }}
        hitSlop={10}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.plus, { backgroundColor: pressed ? c.surface2 : 'transparent' }]}
      >
        <Icon name="add" size={24} color={c.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Menü schließen" onPress={() => setOpen(false)} />
        <View
          style={[
            styles.menu,
            raisedShadow[scheme],
            { top: insets.top + 52, backgroundColor: c.surface, borderColor: withAlpha(c.text, 0.08) },
          ]}
        >
          <MenuRow icon="pairing" label="Gerät hinzufügen" onPress={() => go('/admin/devices')} />
          <MenuRow icon="room" label="Raum hinzufügen" onPress={() => go('/admin/rooms?new=1')} />
        </View>
      </Modal>
    </>
  );
}

function MenuRow({ icon, label, onPress }: { icon: 'pairing' | 'room'; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="menuitem"
      onPress={onPress}
      style={({ pressed }) => [styles.item, { backgroundColor: pressed ? c.surface2 : 'transparent' }]}
    >
      <IconCircle icon={icon} tone="accent" size={32} />
      <AppText weight="medium">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  menu: { position: 'absolute', right: space.lg, minWidth: 220, padding: space.xs, borderRadius: radius.lg, borderWidth: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.sm, borderRadius: radius.md },
});
