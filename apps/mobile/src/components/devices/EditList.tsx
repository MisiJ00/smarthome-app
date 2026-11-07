// Star, eye and grip are not among the theme's icon names (yet), so straight from Lucide
import { Eye, EyeOff, GripVertical, Star } from 'lucide-react-native';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { NestedReorderableList, ScrollViewContainer, useReorderableDrag, type ReorderableListReorderEvent } from 'react-native-reorderable-list';

import type { Device, Room } from '@smarthome/api-client';
import {
  arrangeDevices,
  deviceKey,
  hiddenDevices,
  MAX_WIDGET,
  moveDevice,
  setGrouping,
  setTileSize,
  tileSize,
  toggleHidden,
  toggleWidget,
  withFullOrder,
  type DashboardLayout,
  type TileSize,
} from '@smarthome/core';

import { radius, space, useColors, withAlpha } from '../../lib/theme';
import { Icon } from '../Icon';
import { AppText, Button, useToast } from '../ui';
import { tickFeedback } from './haptics';
import { typeIcon } from './meta';
import { Segmented } from './Segmented';

const SIZES: Array<{ value: TileSize; label: string }> = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
];

/**
 * The edit mode: devices as rows, sorted by holding the handle and dragging (react-native-reorderable-list), per row
 * the size S/M/L, hiding (eye) and "Im Widget" (star, at most four). On top grouping and "Fertig" (saves); hidden
 * devices under "Ausgeblendet". With grouping by rooms each room is its own list, so a device stays in its room.
 */
export function EditList({
  devices,
  rooms,
  layout,
  onChange,
  onDone,
  header,
}: {
  devices: Device[];
  rooms: Room[];
  layout: DashboardLayout;
  onChange: (layout: DashboardLayout) => void;
  onDone: () => void;
  header: ReactNode;
}) {
  const c = useColors();
  const toast = useToast();
  const groups = arrangeDevices(devices, layout, rooms);
  const hidden = hiddenDevices(devices, layout, rooms);

  const reorder = (ids: string[], { from, to }: ReorderableListReorderEvent) => {
    if (from === to) {
      return;
    }
    // a device that arrived while editing first gets its place in the order
    const full = ids.every((id) => layout.order.includes(id)) ? layout : withFullOrder(layout, devices, rooms);
    tickFeedback();
    onChange(moveDevice(full, ids[from]!, full.order.indexOf(ids[to]!)));
  };
  const star = (id: string) => {
    const next = toggleWidget(layout, id);
    if (next === layout) {
      toast('info', `Höchstens ${MAX_WIDGET} Geräte im Widget`);
      return;
    }
    tickFeedback();
    onChange(next);
  };

  return (
    <ScrollViewContainer contentContainerStyle={styles.content}>
      {header}
      <View style={[styles.bar, { backgroundColor: c.surface, borderColor: withAlpha(c.accent, 0.3) }]}>
        <AppText weight="semibold">Startseite anpassen</AppText>
        <AppText variant="small" color={c.muted}>
          Griff halten und ziehen zum Sortieren, Größe wählen, Auge blendet aus, Stern legt ins Widget.
        </AppText>
        <Segmented
          label="Anordnung"
          segments={[
            { value: 'rooms', label: 'Nach Räumen', icon: 'room' },
            { value: 'custom', label: 'Eigene Reihenfolge', icon: 'devices' },
          ]}
          value={layout.grouping}
          onChange={(g) => onChange(setGrouping(layout, g as DashboardLayout['grouping']))}
        />
        <Button title="Fertig" kind="primary" icon="check" onPress={onDone} />
      </View>

      {groups.map((group) => {
        const ids = group.devices.map(deviceKey);
        return (
          <View key={group.room?.id ?? 'none'} style={styles.group}>
            {layout.grouping === 'rooms' && (
              <AppText variant="heading" weight="bold">
                {group.room?.name ?? 'Ohne Raum'}
              </AppText>
            )}
            <NestedReorderableList
              data={group.devices}
              keyExtractor={deviceKey}
              onReorder={(event) => reorder(ids, event)}
              renderItem={({ item }: ListRenderItemInfo<Device>) => (
                <EditRow
                  device={item}
                  size={tileSize(layout, item)}
                  starred={layout.widget.includes(deviceKey(item))}
                  onSize={(s) => onChange(setTileSize(layout, deviceKey(item), s))}
                  onHide={() => onChange(toggleHidden(layout, deviceKey(item)))}
                  onStar={() => star(deviceKey(item))}
                />
              )}
              ItemSeparatorComponent={Separator}
            />
          </View>
        );
      })}

      {hidden.length > 0 && (
        <View style={styles.group}>
          <AppText variant="heading" weight="bold" color={c.muted}>
            Ausgeblendet
          </AppText>
          {hidden.map((device) => (
            <View key={device.id} style={[styles.row, styles.hiddenRow, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Icon name={typeIcon(device.type)} size={20} color={c.muted} />
              <AppText style={styles.grow} numberOfLines={2} color={c.muted}>
                {device.name}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${device.name} wieder anzeigen`}
                onPress={() => onChange(toggleHidden(layout, deviceKey(device)))}
                hitSlop={6}
                style={styles.iconButton}
              >
                <Eye size={20} color={c.text} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollViewContainer>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const EditRow = memo(function EditRow({
  device,
  size,
  starred,
  onSize,
  onHide,
  onStar,
}: {
  device: Device;
  size: TileSize;
  starred: boolean;
  onSize: (size: TileSize) => void;
  onHide: () => void;
  onStar: () => void;
}) {
  const c = useColors();
  const drag = useReorderableDrag();
  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderColor: withAlpha(c.text, 0.08) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${device.name} verschieben`}
        accessibilityHint="Halten und ziehen"
        onLongPress={drag}
        delayLongPress={150}
        hitSlop={8}
        style={styles.handle}
      >
        <GripVertical size={20} color={c.muted} />
      </Pressable>
      <Icon name={typeIcon(device.type)} size={20} color={c.text} />
      <AppText style={styles.grow} numberOfLines={2} weight="medium">
        {device.name}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={starred ? `${device.name} aus dem Widget nehmen` : `${device.name} ins Widget`}
        accessibilityState={{ selected: starred }}
        onPress={onStar}
        hitSlop={6}
        style={styles.iconButton}
      >
        <Star size={20} color={starred ? c.on : c.muted} fill={starred ? c.on : 'transparent'} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${device.name} ausblenden`} onPress={onHide} hitSlop={6} style={styles.iconButton}>
        <EyeOff size={20} color={c.muted} />
      </Pressable>
      {/* second line, under the name: the size */}
      <View style={styles.sizes}>
        <Segmented label={`Größe von ${device.name}`} segments={SIZES} value={size} onChange={(s) => onSize(s as TileSize)} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, paddingBottom: 80, gap: space.lg },
  bar: { marginHorizontal: space.lg, padding: 18, borderRadius: radius.lg, borderWidth: 1, gap: space.md },
  group: { paddingHorizontal: space.lg, gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: 10, paddingHorizontal: space.sm, borderRadius: radius.lg, borderWidth: 1 },
  hiddenRow: { opacity: 0.8 },
  separator: { height: space.sm },
  handle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0 },
  sizes: { flexBasis: '100%', paddingLeft: 80, paddingRight: space.sm },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
