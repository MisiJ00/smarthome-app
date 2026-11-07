import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { raisedShadow, space, useColors, useScheme, withAlpha } from '../../lib/theme';
import { AppText, IconButton } from '../ui';

/**
 * A bottom sheet with a title for short forms (name, room …), like the device details. The keyboard pushes it up
 * (the app draws edge to edge, so the window does not shrink by itself). Errors belong inside the sheet: toasts are
 * drawn behind a Modal.
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Schließen" onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, raisedShadow[scheme], { backgroundColor: c.surface, borderColor: withAlpha(c.text, 0.08), paddingBottom: insets.bottom + space.xl }]}
        >
          <View style={styles.top}>
            <View style={[styles.grip, { backgroundColor: withAlpha(c.text, 0.18) }]} />
            <View style={styles.close}>
              <IconButton icon="close" label="Schließen" onPress={onClose} />
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, paddingTop: 10 },
  top: { alignItems: 'center', minHeight: 20, justifyContent: 'flex-start' },
  grip: { width: 44, height: 5, borderRadius: 3 },
  close: { position: 'absolute', right: space.lg, top: 6, zIndex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.lg },
});
