import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fontSize, fontWeight, radius, space, useColors, type Colors } from '../lib/theme';

export function Screen({ children, centered }: { children: ReactNode; centered?: boolean }) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }, centered && styles.centered]} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, highlight }: { children: ReactNode; highlight?: string }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: highlight ?? c.border }]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function Muted({ children, small }: { children: ReactNode; small?: boolean }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: small ? fontSize.sm : fontSize.md }}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'default',
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  kind?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
}) {
  const c = useColors();
  const look = buttonLook(c, kind);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, look.box, (disabled || busy) && styles.disabled, pressed && styles.pressed]}
    >
      {busy ? <ActivityIndicator color={look.text.color} /> : <Text style={[styles.buttonText, look.text]}>{title}</Text>}
    </Pressable>
  );
}

function buttonLook(c: Colors, kind: 'default' | 'primary' | 'danger' | 'ghost') {
  switch (kind) {
    case 'primary':
      return { box: { backgroundColor: c.accent, borderColor: c.accent }, text: { color: c.accentText } };
    case 'danger':
      return { box: { backgroundColor: c.surface, borderColor: c.danger }, text: { color: c.danger } };
    case 'ghost':
      return { box: { backgroundColor: 'transparent', borderColor: 'transparent' }, text: { color: c.accent } };
    default:
      return { box: { backgroundColor: c.surface, borderColor: c.border }, text: { color: c.text } };
  }
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
      />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  return children ? <Text style={{ color: c.danger }}>{children}</Text> : null;
}

// Short notices at the bottom, e.g. "wartet auf Freigabe"

type ToastKind = 'info' | 'success' | 'error';
const ToastContext = createContext<(kind: ToastKind, text: string) => void>(() => {});
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const [toasts, setToasts] = useState<Array<{ id: number; kind: ToastKind; text: string }>>([]);
  const show = useCallback((kind: ToastKind, text: string) => {
    const id = nextId++;
    setToasts((all) => [...all, { id, kind, text }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.toasts}>
        {toasts.map((t) => (
          <View
            key={t.id}
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: t.kind === 'error' ? c.danger : t.kind === 'success' ? c.ok : c.text }]}
          >
            <Text style={{ color: t.kind === 'info' ? c.bg : '#fff' }}>{t.text}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { justifyContent: 'center', padding: space.xl },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  button: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  field: { gap: space.xs },
  label: { fontWeight: fontWeight.semibold },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 16 },
  toasts: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.xxl, gap: space.sm },
  toast: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
