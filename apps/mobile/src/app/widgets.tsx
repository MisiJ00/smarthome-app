import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { homescreenItems, widgetErrorText, type WidgetData } from '@smarthome/core';

import { AppText, Badge, Card, EmptyState, ErrorText, IconButton, Muted, Screen, ScreenHeader, Skeleton, useToast } from '../components/ui';
import { useReorderWidgets, useRemoveWidgets, useWidgetData } from '../lib/widgets';
import { space } from '../lib/theme';

const KINDS: Record<string, string> = {
  switch: 'Schalter',
  dimmer: 'Dimmer',
  thermostat: 'Thermostat',
  lock: 'Schloss',
  status: 'Status',
  room: 'Raum',
};

/**
 * The person's widgets from the server in the order the home screen widget uses: the first four it can draw are on the
 * home screen, the rest are only stored. Move them up or down, or remove one. Devices are added with the star in the
 * edit mode of the start page.
 */
export default function WidgetsScreen() {
  const data = useWidgetData();
  const reorder = useReorderWidgets();
  const remove = useRemoveWidgets();
  const toast = useToast();
  const [error, setError] = useState('');
  const list = data.data ?? [];
  const onHomeScreen = new Set(homescreenItems(list).map((item) => item.id));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) {
      return;
    }
    const ids = list.map((w) => w.id!);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    setError('');
    reorder.mutate(ids, { onError: (e) => setError(widgetErrorText(e)) });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Widget" onBack={() => router.back()} />
        <Muted small>
          Auf dem Homescreen erscheinen die ersten vier Geräte dieser Liste. Neue Geräte legst du auf der Startseite mit „Anpassen“ und dem Stern
          ins Widget.
        </Muted>
        {data.isPending && <Skeleton height={64} />}
        {data.isError && <ErrorText>{widgetErrorText(data.error, 'Die Widgets konnten nicht geladen werden.')}</ErrorText>}
        {data.data && list.length === 0 && (
          <Card>
            <EmptyState icon="device" title="Noch keine Widgets" text="Wähle auf der Startseite unter „Anpassen“ Geräte mit dem Stern aus." />
          </Card>
        )}
        <ErrorText>{error}</ErrorText>
        <View style={styles.list}>
          {list.map((widget, index) => (
            <Row
              key={widget.id}
              widget={widget}
              shown={onHomeScreen.has(String(widget.id))}
              first={index === 0}
              last={index === list.length - 1}
              busy={reorder.isPending || remove.isPending}
              onUp={() => move(index, index - 1)}
              onDown={() => move(index, index + 1)}
              onRemove={() =>
                remove.mutate([widget.id!], {
                  onSuccess: () => toast('success', 'Aus dem Widget entfernt'),
                  onError: (e) => setError(widgetErrorText(e)),
                })
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({
  widget,
  shown,
  first,
  last,
  busy,
  onUp,
  onDown,
  onRemove,
}: {
  widget: WidgetData;
  shown: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  // What the server sends is shown as plain text; a device the person may no longer see has no name
  const name = widget.available ? (widget.name ?? 'Gerät') : 'Nicht verfügbar';
  const kind = KINDS[widget.kind ?? ''] ?? 'Widget';
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.main}>
          <AppText weight="semibold" numberOfLines={2}>
            {name}
          </AppText>
          <View style={styles.badges}>
            <Badge label={kind} />
            {shown ? <Badge label="Auf dem Homescreen" tone="ok" /> : <Badge label={widget.kind === 'room' ? 'Nur gespeichert' : 'Nicht auf dem Homescreen'} tone="neutral" />}
            {!widget.available && <Badge label="Kein Zugriff" tone="warn" />}
          </View>
        </View>
        <IconButton icon="up" label={`${name} nach oben`} disabled={first || busy} onPress={onUp} />
        <IconButton icon="down" label={`${name} nach unten`} disabled={last || busy} onPress={onDown} />
        <IconButton icon="delete" label={`${name} entfernen`} disabled={busy} onPress={onRemove} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  list: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  main: { flex: 1, minWidth: 0, gap: space.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
