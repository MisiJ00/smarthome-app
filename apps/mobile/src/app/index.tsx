import { Link, router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Device, LiveEvent } from '@smarthome/api-client';
import {
  arrangeDevices,
  deviceKey,
  greeting,
  groupByRoom,
  homeFacts,
  pruneLayout,
  tileSize,
  withFullOrder,
  type DashboardLayout,
  type RoomGroup,
} from '@smarthome/core';

import { AddMenu } from '../components/admin/AddMenu';
import { Confirmations } from '../components/Confirmations';
import { DeviceCard } from '../components/DeviceCard';
import { ConfirmProvider } from '../components/devices/ConfirmAction';
import { DetailSheet } from '../components/devices/DetailSheet';
import { DeviceTile } from '../components/devices/DeviceTile';
import { EditList } from '../components/devices/EditList';
import { RoomChips } from '../components/devices/RoomChips';
import { useDashboardLayout } from '../components/devices/useDashboardLayout';
import { Icon } from '../components/Icon';
import { AppText, Button, Card, EmptyState, ErrorText, Screen, Skeleton, SkeletonCard, useToast } from '../components/ui';
import { useIsAdmin } from '../lib/admin';
import { useDevices, useMe, useRooms } from '../lib/api';
import { useLiveEvents, type LiveStatus } from '../lib/live';
import { fonts, radius, space, useAppearance, useColors, withAlpha } from '../lib/theme';
import { useWidgetSync } from '../widget/useWidgetSync';

/** Filter value of the devices without room (rooms have numeric ids). */
const NO_ROOM = 'none';

const keyOf = (group: RoomGroup) => (group.room?.id !== undefined ? String(group.room.id) : NO_ROOM);

/**
 * The dashboard: devices as tiles in the user's order and sizes (docs/DESIGN-V2.md, 2–4), filterable by room, with
 * live state. Tap switches, long press opens the details; "Anpassen" sorts, sizes and hides (saved per user).
 */
export default function HomeScreen() {
  const c = useColors();
  const me = useMe();
  const rooms = useRooms();
  const devices = useDevices();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<string | null>(null);
  const { layout, loaded, save } = useDashboardLayout(me.data?.id);
  /** The layout being edited; null outside the edit mode. */
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  // two columns: S is half the width, M and L the whole
  const half = Math.floor((width - 2 * space.lg - space.md) / 2);

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === 'confirmation.created' && event.data.canDecide) {
        toast('info', `${event.data.userName} möchte ${event.data.deviceName} ${event.data.action === 'unlock' ? 'öffnen' : 'schalten'}`);
      }
      // own approvals happen in the confirm dialog, which says "Tür geöffnet" itself
      if (event.type === 'confirmation.rejected' && event.data.mine) {
        toast('error', `${event.data.deviceName}: abgelehnt`);
      }
    },
    [toast],
  );
  const live = useLiveEvents(onEvent);
  // the home screen widget follows live changes, stars and colours
  useWidgetSync(devices.data, layout, loaded, useAppearance().appearance);
  const roomList = rooms.data ?? [];
  const deviceList = devices.data ?? [];
  const hidden = new Set(layout.hidden);
  // Chips and the summary go by room, whatever the grouping
  const groups = groupByRoom(roomList, deviceList.filter((d) => !hidden.has(deviceKey(d))));
  const failed = rooms.isError || devices.isError;
  const loading = !failed && (rooms.isPending || devices.isPending || (me.data !== undefined && !loaded));
  // A room that has gone (or lost its devices) shows everything again
  const selected = groups.some((g) => keyOf(g) === filter) ? filter : null;
  const known = new Set(roomList.map((r) => r.id));
  const roomKeyOf = (d: Device) => (d.roomId != null && known.has(d.roomId) ? String(d.roomId) : NO_ROOM);
  const shown = arrangeDevices(selected === null ? deviceList : deviceList.filter((d) => roomKeyOf(d) === selected), layout, roomList);
  const facts = homeFacts(groups);
  const details = deviceList.find((d) => deviceKey(d) === detailsId);

  const startEditing = () => {
    setFilter(null);
    // with all devices in the order, moving works with plain indexes
    setDraft(withFullOrder(layout, deviceList, roomList));
  };
  const finishEditing = () => {
    if (draft) {
      // ids of devices that are gone do not need to stay in the stored layout
      save(pruneLayout(draft, deviceList.map(deviceKey)));
    }
    setDraft(null);
  };

  const intro: ReactNode = (
    // the greeting gets the whole width (display cut), below it the facts as pills and "Anpassen", like on the web
    <View style={styles.intro}>
      <AppText variant="display" accessibilityRole="header" style={styles.greeting}>
        {greeting(me.data?.name)}
      </AppText>
      <View style={styles.introRow}>
        {!loading && !failed && facts.switchable > 0 && (
          <View style={[styles.fact, { backgroundColor: withAlpha(c.surface, 0.8), borderColor: withAlpha(c.text, 0.08) }]}>
            <Icon name="power" size={14} color={facts.onCount > 0 ? c.accentInk : c.muted} />
            <AppText variant="small" weight="semibold" tabular>
              {facts.onCount === 0 ? 'Alles aus' : `${facts.onCount} ${facts.onCount === 1 ? 'Gerät' : 'Geräte'} an`}
            </AppText>
          </View>
        )}
        {!loading && !failed && facts.temperature && (
          <View style={[styles.fact, { backgroundColor: withAlpha(c.surface, 0.8), borderColor: withAlpha(c.text, 0.08) }]}>
            <Icon name="temperature" size={14} color={c.muted} />
            <AppText variant="small" weight="semibold" tabular numberOfLines={1}>
              {facts.temperature.room ? `${facts.temperature.value} ${facts.temperature.room}` : facts.temperature.value}
            </AppText>
          </View>
        )}
        <View style={styles.grow} />
        {draft === null && !loading && deviceList.length > 0 && <Button title="Anpassen" icon="edit" kind="ghost" small onPress={startEditing} />}
      </View>
    </View>
  );

  return (
    // Actions that need an approval are confirmed right here with the fingerprint (no one else has to)
    <ConfirmProvider>
      <Screen>
        <View style={styles.header}>
          <View style={styles.row}>
            <View style={[styles.logo, { backgroundColor: c.accent }]}>
              <Icon name="home" size={18} color={c.accentText} />
            </View>
            <AppText variant="heading" weight="bold">
              Smart Home
            </AppText>
            <View
              accessible
              accessibilityLabel={liveText[live]}
              style={[styles.dot, { backgroundColor: live === 'live' ? c.ok : live === 'offline' ? c.warn : c.muted }]}
            />
          </View>
          <View style={styles.row}>
            {isAdmin && <AddMenu />}
            <Link href="/settings" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Einstellungen"
                hitSlop={10}
                style={({ pressed }) => [styles.gear, { backgroundColor: pressed ? c.surface2 : 'transparent' }]}
              >
                <Icon name="settings" size={22} color={c.text} />
              </Pressable>
            </Link>
          </View>
        </View>

        {draft !== null ? (
          <EditList devices={deviceList} rooms={roomList} layout={draft} onChange={setDraft} onDone={finishEditing} header={intro} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={rooms.isRefetching || devices.isRefetching}
                onRefresh={() => void Promise.all([rooms.refetch(), devices.refetch()])}
                colors={[c.accent]}
                tintColor={c.accent}
                progressBackgroundColor={c.surface}
              />
            }
          >
            {intro}
            {groups.length > 1 && (
              <RoomChips
                chips={groups.map((g) => ({ key: keyOf(g), label: g.room?.name ?? 'Ohne Raum', count: g.devices.length }))}
                selected={selected}
                onSelect={setFilter}
              />
            )}
            <View style={styles.padded}>
              <Confirmations />
              {loading && (
                <View style={styles.room} accessibilityLabel="Lade Geräte …" accessibilityState={{ busy: true }}>
                  <Skeleton width={120} height={18} />
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </View>
              )}
              {failed && <ErrorText>Die Geräte konnten nicht geladen werden. Zum Neuladen nach unten ziehen.</ErrorText>}
              {!loading && !failed && deviceList.length === 0 && (
                <Card>
                  <EmptyState
                    icon="home"
                    title="Noch keine Geräte"
                    text={isAdmin ? 'Suche neue Geräte und übernimm sie, dann erscheinen sie hier.' : 'Sobald ein Admin dir Rechte gegeben hat, erscheinen sie hier.'}
                  />
                  {isAdmin && (
                    <View style={styles.emptyActions}>
                      <Button title="Gerät hinzufügen" kind="primary" icon="add" onPress={() => router.push('/admin/devices')} />
                      {roomList.length === 0 && <Button title="Raum hinzufügen" icon="room" onPress={() => router.push('/admin/rooms?new=1')} />}
                    </View>
                  )}
                </Card>
              )}
              {!loading && !failed && deviceList.length > 0 && shown.length === 0 && (
                <Card>
                  <EmptyState icon="empty" title="Alles ausgeblendet" text="Unter „Anpassen“ kannst du Geräte wieder einblenden." />
                </Card>
              )}
              {!loading &&
                shown.map((group) => (
                  <View key={group.room?.id ?? 'none'} style={styles.room}>
                    {layout.grouping === 'rooms' && (
                      <View style={styles.roomHead}>
                        <AppText variant="heading" weight="bold">
                          {group.room?.name ?? 'Ohne Raum'}
                        </AppText>
                        <AppText variant="small" color={c.muted} tabular>
                          {group.devices.length}
                        </AppText>
                      </View>
                    )}
                    <View style={styles.tiles}>
                      {group.devices.map((device) => {
                        const size = tileSize(layout, device);
                        return (
                          <View key={device.id} style={size === 's' ? { width: half } : styles.full}>
                            {size === 'l' ? (
                              <DeviceCard device={device} />
                            ) : (
                              <DeviceTile device={device} size={size} onDetails={() => setDetailsId(deviceKey(device))} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
            </View>
          </ScrollView>
        )}
        <DetailSheet device={details} onClose={() => setDetailsId(null)} />
      </Screen>
    </ConfirmProvider>
  );
}

const liveText: Record<LiveStatus, string> = { connecting: 'Verbinde', live: 'Live', offline: 'Offline, verbinde neu' };

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: space.sm, paddingBottom: 80, gap: space.lg },
  intro: { gap: space.md, paddingHorizontal: space.lg },
  greeting: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 40, letterSpacing: -1.4 },
  introRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1 },
  grow: { flex: 1, minWidth: 0 },
  padded: { paddingHorizontal: space.lg, gap: space.xl },
  room: { gap: space.md },
  roomHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  full: { width: '100%' },
  emptyActions: { gap: space.sm },
});
