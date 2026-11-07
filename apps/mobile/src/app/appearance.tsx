import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import ColorPicker, { HueSlider, Panel1, type ColorFormatsObject } from 'reanimated-color-picker';

import { DEFAULT_APPEARANCE, contrast, deriveColors, paletteIds, palettes, type AppearanceMode, type AppearanceStyle, type PaletteId } from '@smarthome/theme';

import { Icon } from '../components/Icon';
import { AppText, Button, Card, GradientFill, Muted, Screen, ScreenHeader } from '../components/ui';
import { cardShadow, glowShadow, modeIcons, modeNames, radius, space, useAppearance, useColors, useScheme, useVivid, withAlpha, type IconName } from '../lib/theme';

const MODES: AppearanceMode[] = ['system', 'light', 'dark', 'black'];
const STYLES: { id: AppearanceStyle; name: string; text: string; icon: IconName }[] = [
  { id: 'vivid', name: 'Kräftig', text: 'Verläufe und Leuchten in der Akzentfarbe', icon: 'vivid' },
  { id: 'calm', name: 'Ruhig', text: 'Flach, getönte Flächen statt Verläufe', icon: 'calm' },
];

const tap = () => void Haptics.selectionAsync().catch(() => {});

/** Colour world, own colours, mode and style; every change shows at once and is remembered on this phone. */
export default function AppearanceScreen() {
  const { appearance, setAppearance, updateAppearance } = useAppearance();
  const c = useColors();
  const custom = appearance.custom ?? { accent: c.accent, accent2: c.accent2 };
  const setCustom = (change: Partial<typeof custom>) => updateAppearance({ palette: 'custom', custom: { ...custom, ...change } });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Darstellung" onBack={() => router.back()} />
        <Hero />

        <Section title="Farbwelt">
          <View style={styles.grid}>
            {paletteIds.map((id) => (
              <PaletteCard
                key={id}
                id={id}
                selected={appearance.palette === id}
                onPress={() => {
                  tap();
                  updateAppearance({ palette: id });
                }}
              />
            ))}
            <PaletteCard
              id="custom"
              custom={custom}
              selected={appearance.palette === 'custom'}
              onPress={() => {
                tap();
                setCustom({});
              }}
            />
          </View>
        </Section>

        {appearance.palette === 'custom' && <CustomColors custom={custom} onChange={setCustom} />}

        <Section title="Modus">
          <View style={styles.grid}>
            {MODES.map((mode) => (
              <Choice
                key={mode}
                icon={modeIcons[mode]}
                label={modeNames[mode]}
                selected={appearance.mode === mode}
                onPress={() => {
                  tap();
                  updateAppearance({ mode });
                }}
              />
            ))}
          </View>
          <Muted small>„Schwarz“ ist echtes Schwarz für OLED-Bildschirme und spart Akku.</Muted>
        </Section>

        <Section title="Stil">
          {STYLES.map((style) => (
            <StyleCard
              key={style.id}
              {...style}
              selected={appearance.style === style.id}
              onPress={() => {
                tap();
                updateAppearance({ style: style.id });
              }}
            />
          ))}
        </Section>

        <Button title="Zurücksetzen" kind="ghost" icon="refresh" onPress={() => setAppearance({ ...DEFAULT_APPEARANCE })} />
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** Live preview of the current choice: a switched-on tile next to a switched-off one. */
function Hero() {
  const c = useColors();
  const { appearance } = useAppearance();
  const vivid = appearance.style === 'vivid';
  return (
    <View style={styles.heroRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.heroTile, glowShadow(c.accent, vivid), !vivid && { backgroundColor: c.onSoft }]}>
        {vivid && <GradientFill style={StyleSheet.absoluteFill} />}
        <Icon name="light" size={26} color={vivid ? c.accentText : c.on} />
        <View>
          <AppText weight="semibold" color={vivid ? c.accentText : c.text}>
            Wohnzimmer
          </AppText>
          <AppText variant="small" color={vivid ? c.accentText : c.muted}>
            An · 80 %
          </AppText>
        </View>
      </View>
      <Card style={styles.heroOff}>
        <Icon name="plug" size={26} color={c.muted} />
        <View>
          <AppText weight="semibold">Steckdose</AppText>
          <Muted small>Aus</Muted>
        </View>
      </Card>
    </View>
  );
}

/** A preset with a small preview in its own colours (current mode). */
function PaletteCard({
  id,
  custom,
  selected,
  onPress,
}: {
  id: PaletteId | 'custom';
  custom?: { accent: string; accent2: string };
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const { scheme } = useAppearance();
  const vivid = useVivid();
  const p = deriveColors(id, scheme, custom);
  const name = id === 'custom' ? 'Eigene Farben' : palettes[id].name;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.palette,
        cardShadow[shadeOf(scheme)],
        { backgroundColor: c.surface, borderColor: selected ? p.accent : withAlpha(c.text, 0.08) },
        pressed && styles.pressed,
      ]}
    >
      {/* a miniature of the start page in this colour world (like the web): greeting, chips, a lit, a dark and a wide tile */}
      <View style={[styles.preview, { backgroundColor: p.bg, borderColor: withAlpha(p.text, 0.08) }]}>
        <View style={[styles.previewGreeting, { backgroundColor: p.text }]} />
        <View style={styles.previewChips}>
          <GradientFill colors={p.gradient} always={vivid} style={[styles.previewChip, styles.previewChipOn]} />
          <View style={[styles.previewChip, { backgroundColor: p.surface, borderColor: withAlpha(p.text, 0.1) }]} />
          <View style={[styles.previewChip, { backgroundColor: p.surface, borderColor: withAlpha(p.text, 0.1) }]} />
        </View>
        <View style={styles.previewTiles}>
          {vivid ? (
            <GradientFill colors={p.gradient} always style={[styles.previewTile, glowShadow(p.accent, true)]}>
              <Icon name="light" size={14} color={p.accentText} />
              <View style={[styles.previewLine, { backgroundColor: withAlpha(p.accentText, 0.6) }]} />
            </GradientFill>
          ) : (
            <View style={[styles.previewTile, { backgroundColor: p.onSoft }]}>
              <Icon name="light" size={14} color={p.on} />
              <View style={[styles.previewLine, { backgroundColor: withAlpha(p.text, 0.6) }]} />
            </View>
          )}
          <View style={[styles.previewTile, { backgroundColor: p.surface, borderColor: withAlpha(p.text, 0.07) }]}>
            <Icon name={id === 'custom' ? 'customColor' : 'plug'} size={14} color={p.muted} />
            <View style={[styles.previewLine, { backgroundColor: withAlpha(p.muted, 0.6) }]} />
          </View>
        </View>
        <View style={[styles.previewWide, { backgroundColor: p.surface, borderColor: withAlpha(p.text, 0.07) }]}>
          <View style={styles.previewWideTop}>
            <Icon name="climate" size={14} color={p.muted} />
            <AppText weight="bold" color={p.text} style={styles.previewTemp}>
              21°
            </AppText>
          </View>
          <View style={[styles.previewRange, { backgroundColor: p.surface2 }]}>
            <GradientFill colors={p.gradient} always={vivid} style={styles.previewRangeFill} />
          </View>
        </View>
      </View>
      <View style={styles.paletteName}>
        <GradientFill colors={p.gradient} always style={styles.paletteSwatch} />
        <AppText weight="semibold" style={styles.flex}>
          {name}
        </AppText>
        {selected && <Icon name="check" size={18} color={c.accentInk} />}
      </View>
    </Pressable>
  );
}

function shadeOf(scheme: string): 'light' | 'dark' {
  return scheme === 'light' ? 'light' : 'dark';
}

/** Two colours with one picker: choose which one to edit, then pick it. */
function CustomColors({ custom, onChange }: { custom: { accent: string; accent2: string }; onChange: (change: Partial<{ accent: string; accent2: string }>) => void }) {
  const c = useColors();
  const [editing, setEditing] = useState<'accent' | 'accent2'>('accent');
  const ratio = contrast(c.accentText, c.accent);
  return (
    <Card>
      <View style={styles.row}>
        <Icon name="customColor" size={18} color={c.accentInk} />
        <AppText weight="semibold">Eigene Farben</AppText>
      </View>
      <View style={styles.row}>
        {(['accent', 'accent2'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: editing === key }}
            accessibilityLabel={key === 'accent' ? 'Akzent' : 'Verlaufsende'}
            onPress={() => setEditing(key)}
            style={[styles.swatchButton, { borderColor: editing === key ? c.accent : c.border, backgroundColor: c.surface }]}
          >
            <View style={[styles.swatch, { backgroundColor: custom[key] }]} />
            <View>
              <AppText variant="small" weight="semibold">
                {key === 'accent' ? 'Akzent' : 'Verlaufsende'}
              </AppText>
              <AppText variant="caption" color={c.muted} tabular>
                {custom[key]}
              </AppText>
            </View>
          </Pressable>
        ))}
      </View>
      <ColorPicker
        key={editing}
        value={custom[editing]}
        onCompleteJS={(color: ColorFormatsObject) => onChange({ [editing]: color.hex.slice(0, 7) })}
        style={styles.picker}
      >
        <Panel1 style={styles.panel} />
        <HueSlider style={styles.hue} />
      </ColorPicker>
      <Muted small>
        Schrift auf der Akzentfarbe: {c.accentText === '#ffffff' ? 'weiß' : 'dunkel'} (Kontrast {ratio.toFixed(1).replace('.', ',')} : 1). Sie wechselt von
        selbst, damit alles lesbar bleibt.
      </Muted>
    </Card>
  );
}

function Choice({ icon, label, selected, onPress }: { icon: IconName; label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const shade = useScheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : 'transparent' },
        !selected && cardShadow[shade],
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={20} color={selected ? c.accentInk : c.muted} />
      <AppText weight="semibold" color={selected ? c.accentInk : c.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

function StyleCard({ id, name, text, icon, selected, onPress }: { id: AppearanceStyle; name: string; text: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const shade = useScheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}: ${text}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.styleCard,
        cardShadow[shade],
        { backgroundColor: c.surface, borderColor: selected ? c.accent : 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.styleIcon}>
        {id === 'vivid' ? (
          <GradientFill always style={[StyleSheet.absoluteFill, styles.round]} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.round, { backgroundColor: c.accentSoft }]} />
        )}
        <Icon name={icon} size={20} color={id === 'vivid' ? c.accentText : c.accentInk} />
      </View>
      <View style={styles.flex}>
        <AppText weight="semibold">{name}</AppText>
        <Muted small>{text}</Muted>
      </View>
      {selected && <Icon name="check" size={20} color={c.accentInk} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: 48 },
  section: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  heroRow: { flexDirection: 'row', gap: space.md },
  heroTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroOff: { flex: 1, aspectRatio: 1, justifyContent: 'space-between' },
  palette: { width: '47.5%', flexGrow: 1, borderRadius: radius.lg, borderWidth: 2, padding: 7, gap: space.sm },
  preview: { gap: 6, padding: 10, borderRadius: radius.lg - 6, borderWidth: 1 },
  previewGreeting: { width: '58%', height: 7, borderRadius: 4 },
  previewChips: { flexDirection: 'row', gap: 4 },
  previewChip: { width: 20, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  previewChipOn: { width: 15 },
  previewTiles: { flexDirection: 'row', gap: 5, marginTop: 2 },
  previewTile: { flex: 1, aspectRatio: 1.15, borderRadius: 9, borderWidth: 1, borderColor: 'transparent', padding: 7, justifyContent: 'space-between' },
  previewLine: { width: '70%', height: 4, borderRadius: 2 },
  previewWide: { borderRadius: 9, borderWidth: 1, padding: 7, gap: 5 },
  previewWideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTemp: { fontSize: 12, lineHeight: 14, letterSpacing: -0.3 },
  previewRange: { height: 4, borderRadius: 2, overflow: 'hidden' },
  previewRangeFill: { width: '62%', height: 4 },
  paletteName: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32, paddingHorizontal: 4, paddingBottom: 2 },
  paletteSwatch: { width: 14, height: 14, borderRadius: 7 },
  swatchButton: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, paddingRight: space.md, borderRadius: radius.md, borderWidth: 2 },
  swatch: { width: 32, height: 32, borderRadius: 8 },
  picker: { gap: space.md },
  panel: { height: 180, borderRadius: radius.md },
  hue: { borderRadius: radius.pill },
  choice: {
    width: '47.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  styleCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2 },
  styleIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 14 },
});
