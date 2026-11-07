import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Device } from '@smarthome/api-client';

import { raisedShadow, space, useColors, useScheme, withAlpha } from '../../lib/theme';
import { DeviceCard } from '../DeviceCard';
import { IconButton } from '../ui';

/**
 * All controls of one device (the full DeviceCard) in a bottom sheet; opened by a long press on a tile.
 * `device` undefined: closed. The caller passes the live device, so the sheet follows its state.
 */
export function DetailSheet({ device, onClose }: { device: Device | undefined; onClose: () => void }) {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={device !== undefined} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Schließen" onPress={onClose} />
        {device && (
          <View accessibilityViewIsModal style={[styles.sheet, raisedShadow[scheme], { backgroundColor: c.surface, borderColor: withAlpha(c.text, 0.08), paddingBottom: insets.bottom + space.xl }]}>
            <View style={styles.top}>
              <View style={[styles.grip, { backgroundColor: withAlpha(c.text, 0.18) }]} />
              <View style={styles.close}>
                <IconButton icon="close" label="Schließen" onPress={onClose} size={44} />
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <DeviceCard device={device} variant="sheet" />
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  // like the web sheet: 28 dp corners, a hairline, room around the content
  sheet: { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, paddingTop: 10 },
  top: { alignItems: 'center', minHeight: 52, justifyContent: 'flex-start' },
  grip: { width: 44, height: 5, borderRadius: 3 },
  close: { position: 'absolute', right: space.lg, top: 6 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.md },
});
