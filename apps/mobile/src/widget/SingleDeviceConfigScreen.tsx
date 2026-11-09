import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { unwrap, type Device } from '@smarthome/api-client';
import type { ThemeColors } from '@smarthome/theme';

import { typeLabel } from '../components/devices/meta';
import { loadColors, widgetApi } from './data';
import { bindSingleDevice, loadSingle, singleDeviceOf } from './single';
import { renderSingle } from './widgetTaskHandler';

/**
 * Opens when a single device widget is added and when it is reconfigured (long press on the widget, "Einstellungen"):
 * the devices the person may see, one tap chooses. It runs in its own activity without the app's providers, so it
 * reads the session, the devices and the colours itself (like the widget's task) and uses plain components.
 */
export function SingleDeviceConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const dark = useColorScheme() === 'dark';
  const [colors, setColors] = useState<ThemeColors>();
  const [devices, setDevices] = useState<Device[]>();
  const [current, setCurrent] = useState<number>();
  const [problem, setProblem] = useState('');

  useEffect(() => {
    void (async () => {
      const all = await loadColors();
      setColors(dark ? all.dark : all.light);
      setCurrent(await singleDeviceOf(widgetInfo.widgetId));
      try {
        const api = await widgetApi();
        if (!api) {
          setProblem('Bitte erst in der App anmelden.');
          return;
        }
        // the server does not promise an order: sort by name so the list does not move between looking and tapping
        setDevices([...unwrap(await api.GET('/api/devices'))].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de')));
      } catch {
        setProblem('Die Geräte konnten nicht geladen werden. Ist der Server erreichbar?');
      }
    })();
  }, [dark, widgetInfo.widgetId]);

  const choose = async (device: Device) => {
    if (device.id === undefined) {
      return;
    }
    await bindSingleDevice(widgetInfo.widgetId, device.id);
    // draw the widget at once, then close
    renderWidget(renderSingle(await loadSingle(widgetInfo.widgetId), widgetInfo.width || 160));
    setResult('ok');
  };

  if (!colors) {
    return <View style={styles.fill} />;
  }
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Gerät wählen</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>Dieses Widget zeigt genau ein Gerät.</Text>
      {problem !== '' && <Text style={[styles.hint, { color: colors.text }]}>{problem}</Text>}
      {problem === '' && !devices && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
      <ScrollView contentContainerStyle={styles.list}>
        {(devices ?? []).map((device) => {
          const selected = device.id === current;
          return (
            <Pressable
              key={device.id}
              accessibilityRole="button"
              accessibilityLabel={`${device.name ?? 'Gerät'}, ${typeLabel(device.type)}`}
              onPress={() => void choose(device)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.surface2 }]}
            >
              <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
                {device.name ?? 'Gerät'}
              </Text>
              <Text style={{ color: colors.muted }}>{typeLabel(device.type)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={() => setResult('cancel')} style={[styles.cancel, { backgroundColor: colors.surface2 }]}>
        <Text style={[styles.name, { color: colors.text }]}>Abbrechen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, padding: 20, paddingTop: 56, gap: 8 },
  title: { fontSize: 26, fontWeight: '700' },
  hint: { fontSize: 15 },
  spinner: { marginTop: 24 },
  list: { gap: 10, paddingVertical: 12 },
  row: { padding: 16, borderRadius: 18, borderWidth: 2, gap: 4 },
  name: { fontSize: 17, fontWeight: '600' },
  cancel: { padding: 16, borderRadius: 18, alignItems: 'center' },
});
