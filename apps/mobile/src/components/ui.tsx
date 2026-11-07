import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import {
  cardShadow,
  fonts,
  fontSize,
  glowShadow,
  modeIcons,
  modeNames,
  nextMode,
  radius,
  raisedShadow,
  space,
  useAppearance,
  useColors,
  useScheme,
  useVivid,
  withAlpha,
  type IconName,
  type ThemeColors,
} from '../lib/theme';
import { Icon } from './Icon';

/*
 * The building blocks of the app, in the look of the web interface (v3): Inter with large, tightly set titles, cards
 * with a hairline instead of a hard border, pill buttons and chips (selected chips carry the accent), tinted badges
 * and banners, 44 dp touch targets. Colours follow the colour world and mode.
 */

// ---------- Layout and text ----------

export function Screen({ children, centered, edges = ['top', 'left', 'right'] }: { children: ReactNode; centered?: boolean; edges?: Edge[] }) {
  const c = useColors();
  const { appearance, scheme } = useAppearance();
  // Vivid: a soft glow of the accent colours behind everything; black stays pure black (OLED)
  const glow = appearance.style === 'vivid' && scheme !== 'black';
  const strength = scheme === 'light' ? 0.14 : 0.2;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }, centered && styles.centered]} edges={edges}>
      {glow && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={[withAlpha(c.accent, strength), withAlpha(c.accent, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 0.45 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[withAlpha(c.accent2, 0), withAlpha(c.accent2, strength * 0.8)]}
            start={{ x: 0.3, y: 0.55 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption';
const variants: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 38, letterSpacing: -1.3 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.7 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  body: { fontFamily: fonts.regular, fontSize: fontSize.md, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: fontSize.xs, lineHeight: 16 },
};

/**
 * Text in Inter. `variant` picks size and weight, `weight` overrides the weight, `color` the colour (default: text).
 * Numbers that change (temperatures, percentages) get `tabular`.
 */
export function AppText({
  variant = 'body',
  weight,
  color,
  tabular,
  style,
  ...props
}: TextProps & { variant?: TextVariant; weight?: keyof typeof fonts; color?: string; tabular?: boolean }) {
  const c = useColors();
  return (
    <Text
      {...props}
      style={[
        variants[variant],
        { color: color ?? c.text },
        weight && { fontFamily: fonts[weight] },
        tabular && styles.tabular,
        style,
      ]}
    />
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <AppText variant="title">{children}</AppText>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <AppText variant="heading">{children}</AppText>;
}

export function Muted({ children, small }: { children: ReactNode; small?: boolean }) {
  const c = useColors();
  return (
    <AppText variant={small ? 'small' : 'body'} color={c.muted}>
      {children}
    </AppText>
  );
}

/** Title row of a screen: optional back button, title, optional things on the right. */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack && <IconButton icon="next" label="Zurück" onPress={onBack} flip />}
      <View style={styles.headerTitle}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}

/**
 * Frame of login, setup and server: logo and "Smart Home" on top, the title, the content on a card, `footer` below
 * the card. The app draws edge to edge, so the window does not shrink for the keyboard: KeyboardAvoidingView adds
 * padding at the bottom instead, and the scroll view lets the focused field move into view.
 */
export function AuthScreen({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  const c = useColors();
  const vivid = useVivid();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.authBrand}>
            <GradientFill style={[styles.logo, glowShadow(c.accent, vivid)]}>
              <Icon name="home" size={30} color={c.accentText} />
            </GradientFill>
            <AppText variant="small" weight="semibold" color={c.muted}>
              Smart Home
            </AppText>
          </View>
          <AppText variant="display" style={styles.centerText} accessibilityRole="header">
            {title}
          </AppText>
          <Card style={styles.authCard}>{children}</Card>
          {footer && <View style={styles.authFooter}>{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ---------- Surfaces ----------

/**
 * White card with a soft shadow (dark: brighter surface). `tint` colours the surface (e.g. c.onSoft for a device
 * that is on), `highlight` adds a coloured border, `onPress` makes the whole card pressable.
 */
export function Card({
  children,
  highlight,
  tint,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  highlight?: string;
  tint?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const scheme = useScheme();
  const look: StyleProp<ViewStyle> = [
    styles.card,
    cardShadow[scheme],
    { backgroundColor: tint ?? c.surface, borderColor: highlight ?? withAlpha(c.text, 0.08) },
    style,
  ];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [look, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={look}>{children}</View>;
}

export type Tone = 'neutral' | 'accent' | 'on' | 'ok' | 'warn' | 'danger';

/** Background and foreground of a tinted element per tone. */
export function toneColors(c: ThemeColors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'accent':
      // accentInk: readable on its own tint in every colour world
      return { bg: c.accentSoft, fg: c.accentInk };
    case 'on':
      return { bg: c.onSoft, fg: c.on };
    case 'ok':
      return { bg: c.okSoft, fg: c.ok };
    case 'warn':
      return { bg: c.warnSoft, fg: c.warn };
    case 'danger':
      return { bg: c.dangerSoft, fg: c.danger };
    default:
      return { bg: c.surface2, fg: c.muted };
  }
}

/** Tinted rounded square with an icon (like the tiles), e.g. the device icon on a card. */
export function IconCircle({ icon, tone = 'neutral', size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const c = useColors();
  const t = toneColors(c, tone);
  return (
    <View style={[styles.iconCircle, { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: t.bg }]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

/** Small status label, e.g. "Gesperrt" with a lock. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = useColors();
  const t = toneColors(c, tone);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon && <Icon name={icon} size={12} color={t.fg} />}
      <AppText variant="caption" weight="semibold" color={t.fg}>
        {label}
      </AppText>
    </View>
  );
}

/** Pill-shaped filter, e.g. a room; selected: tinted with the accent colour. */
export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  const c = useColors();
  const vivid = useVivid();
  const fg = selected ? c.accentText : c.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? [{ backgroundColor: c.accent, borderColor: 'transparent' }, glowShadow(c.accent, vivid)]
          : { backgroundColor: withAlpha(c.surface, 0.8), borderColor: withAlpha(c.text, 0.08) },
        pressed && styles.pressed,
      ]}
    >
      {selected && <GradientFill style={[StyleSheet.absoluteFill, styles.chipFill]} />}
      {icon && <Icon name={icon} size={15} color={fg} />}
      <AppText weight="semibold" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A notice across the screen, e.g. an open approval; `actions` (buttons) go below the text. */
export function Banner({
  tone = 'warn',
  icon = 'info',
  title,
  children,
  actions,
}: {
  tone?: Tone;
  icon?: IconName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const c = useColors();
  const t = toneColors(c, tone);
  return (
    <View style={[styles.banner, { backgroundColor: tone === 'neutral' ? c.surface : t.bg }]} accessibilityRole="summary">
      <View style={styles.bannerRow}>
        <View style={[styles.bannerIcon, { backgroundColor: c.surface }]}>
          <Icon name={icon} size={18} color={t.fg} />
        </View>
        <View style={styles.flex}>
          <AppText weight="semibold">{title}</AppText>
          {typeof children === 'string' ? <Muted small>{children}</Muted> : children}
        </View>
      </View>
      {actions && <View style={styles.bannerActions}>{actions}</View>}
    </View>
  );
}

/** Friendly empty state with an icon in a tinted circle. */
export function EmptyState({ icon = 'empty', title, text }: { icon?: IconName; title: string; text?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <IconCircle icon={icon} tone="accent" size={60} />
      <AppText variant="heading" style={styles.centerText}>
        {title}
      </AppText>
      {text && (
        <AppText variant="small" color={c.muted} style={styles.centerText}>
          {text}
        </AppText>
      )}
    </View>
  );
}

// ---------- Loading ----------

/** Grey placeholder that pulses gently (still when the system asks for less motion). */
export function Skeleton({ width = '100%', height = 14, round, style }: { width?: ViewStyle['width']; height?: number; round?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) {
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: c.surface2, opacity }, style]}
    />
  );
}

/** A card-shaped placeholder while devices load. */
export function SkeletonCard() {
  return (
    <Card>
      <View style={styles.bannerRow}>
        <Skeleton width={40} height={40} round />
        <View style={[styles.flex, { gap: space.sm }]}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="35%" height={12} />
        </View>
        <Skeleton width={48} height={28} round />
      </View>
    </Card>
  );
}

// ---------- Buttons and inputs ----------

// ---------- Gradient ----------

/**
 * The accent gradient (accent → accent2, 135°) as a background, e.g. on a switched-on tile:
 * `<GradientFill style={StyleSheet.absoluteFill} />` behind the content, or with children. In the calm style it is a
 * flat accent surface (pass `always` to keep the gradient, e.g. in previews). Text on it: `colors.accentText`.
 */
export function GradientFill({
  colors: own,
  style,
  children,
  always,
}: {
  colors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  always?: boolean;
}) {
  const c = useColors();
  const vivid = useVivid();
  const [from, to] = own ?? c.gradient;
  if (!vivid && !always) {
    return <View style={[{ backgroundColor: from }, style]}>{children}</View>;
  }
  return (
    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} dither style={style}>
      {children}
    </LinearGradient>
  );
}

/** Quick switch of the mode (System → Hell → Dunkel → Schwarz), for screen headers. */
export function ModeToggle() {
  const { appearance, updateAppearance } = useAppearance();
  const mode = appearance.mode;
  return (
    <IconButton icon={modeIcons[mode]} label={`Design: ${modeNames[mode]}, tippen zum Wechseln`} onPress={() => updateAppearance({ mode: nextMode[mode] })} />
  );
}

export type ButtonKind = 'default' | 'primary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  kind = 'default',
  disabled,
  busy,
  icon,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  small?: boolean;
}) {
  const c = useColors();
  const vivid = useVivid();
  const look = buttonLook(c, kind);
  // Vivid: the main action carries the accent gradient and glows
  const gradient = kind === 'primary' && vivid;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        look.box,
        gradient && [styles.gradientButton, !(disabled || busy) && glowShadow(c.accent, true)],
        (disabled || busy) && styles.disabled,
        pressed && (kind === 'ghost' ? { backgroundColor: c.surface2 } : styles.pressed),
      ]}
    >
      {gradient && <GradientFill style={StyleSheet.absoluteFill} />}
      {busy ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 16 : 18} color={look.text} />}
          <AppText variant={small ? 'small' : 'body'} weight="semibold" color={look.text}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

function buttonLook(c: ThemeColors, kind: ButtonKind): { box: ViewStyle; text: string } {
  switch (kind) {
    case 'primary':
      return { box: { backgroundColor: c.accent, borderColor: c.accent }, text: c.accentText };
    case 'danger':
      return { box: { backgroundColor: c.dangerSoft, borderColor: 'transparent' }, text: c.danger };
    case 'ghost':
      return { box: { backgroundColor: 'transparent', borderColor: 'transparent' }, text: c.accentInk };
    default:
      return { box: { backgroundColor: c.surface, borderColor: withAlpha(c.text, 0.1) }, text: c.text };
  }
}

/** Round button with only an icon; `label` is read out by TalkBack. `flip` mirrors it (chevron → back). */
export function IconButton({
  icon,
  label,
  onPress,
  kind = 'ghost',
  size = 44,
  disabled,
  flip,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  size?: number;
  disabled?: boolean;
  flip?: boolean;
}) {
  const c = useColors();
  const vivid = useVivid();
  const look = buttonLook(c, kind);
  // Vivid: a primary icon button (e.g. "+" in a header) carries the accent gradient and glows, like Button
  const gradient = kind === 'primary' && vivid;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        look.box,
        gradient && [styles.gradientButton, !disabled && glowShadow(c.accent, true)],
        disabled && styles.disabled,
        pressed && (kind === 'ghost' ? { backgroundColor: c.surface2 } : styles.pressed),
      ]}
    >
      {gradient && <GradientFill style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />}
      <View style={flip && styles.flip}>
        <Icon name={icon} size={Math.round(size * 0.5)} color={kind === 'ghost' ? c.text : look.text} />
      </View>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="small" weight="medium">
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={c.muted}
        selectionColor={c.accent}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.surface, borderColor: focused ? c.accent : c.border },
          focused && { boxShadow: `0 0 0 3px ${c.accentSoft}` },
        ]}
      />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  if (!children) {
    return null;
  }
  return (
    <View style={[styles.error, { backgroundColor: c.dangerSoft }]} accessibilityLiveRegion="polite">
      <Icon name="warning" size={16} color={c.danger} />
      <AppText variant="small" weight="medium" color={c.danger} style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

// ---------- Toasts: short notices at the bottom, e.g. "wartet auf Freigabe" ----------

type ToastKind = 'info' | 'success' | 'error';
const ToastContext = createContext<(kind: ToastKind, text: string) => void>(() => {});
let nextId = 1;

const toastLook: Record<ToastKind, { icon: IconName; tone: Tone }> = {
  info: { icon: 'info', tone: 'accent' },
  success: { icon: 'check', tone: 'ok' },
  error: { icon: 'warning', tone: 'danger' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
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
      <View pointerEvents="none" style={[styles.toasts, { bottom: insets.bottom + space.lg }]}>
        {toasts.map((t) => {
          const look = toastLook[t.kind];
          const tone = toneColors(c, look.tone);
          return (
            <View key={t.id} accessibilityLiveRegion="polite" style={[styles.toast, raisedShadow[scheme], { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.toastIcon, { backgroundColor: tone.bg }]}>
                <Icon name={look.icon} size={16} color={tone.fg} />
              </View>
              <AppText variant="small" weight="medium" style={styles.flex}>
                {t.text}
              </AppText>
            </View>
          );
        })}
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
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  centerText: { textAlign: 'center' },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg },
  authBrand: { alignItems: 'center', gap: space.sm },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  authCard: { padding: space.xl, gap: space.lg },
  authFooter: { alignItems: 'center', gap: space.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  headerTitle: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  chipFill: { borderRadius: radius.pill },
  banner: { borderRadius: radius.lg, padding: space.md, gap: space.md },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bannerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: 48, paddingHorizontal: space.xl },
  button: {
    flexDirection: 'row',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButton: { borderWidth: 0, overflow: 'hidden' },
  buttonSmall: { minHeight: 44, paddingHorizontal: 18 },
  iconButton: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  field: { gap: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, borderRadius: radius.md, padding: space.md },
  toasts: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  toastIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
