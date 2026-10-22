import { Link } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LiveEvent } from '@smarthome/api-client';
import { groupByRoom } from '@smarthome/core';

import { Confirmations } from '../components/Confirmations';
import { DeviceCard } from '../components/DeviceCard';
import { ErrorText, Muted, Screen, useToast } from '../components/ui';
import { useDevices, useRooms } from '../lib/api';
import { useLiveEvents, type LiveStatus } from '../lib/live';
import { useColors } from '../lib/theme';

/** Devices by room, switchable, with live state and open approvals on top. */
export default function HomeScreen() {
  const c = useColors();
  const rooms = useRooms();
  const devices = useDevices();
  const toast = useToast();

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === 'confirmation.created' && event.data.canDecide) {
        toast('info', `${event.data.userName} möchte ${event.data.deviceName} ${event.data.action === 'unlock' ? 'öffnen' : 'schalten'}`);
      }
      if (event.type === 'confirmation.approved' && event.data.mine) {
        toast('success', `${event.data.deviceName}: freigegeben`);
      }
      if (event.type === 'confirmation.rejected' && event.data.mine) {
        toast('error', `${event.data.deviceName}: abgelehnt`);
      }
    },
    [toast],
  );
  const live = useLiveEvents(onEvent);
  const groups = groupByRoom(rooms.data ?? [], devices.data ?? []);
  const failed = rooms.isError || devices.isError;
  const loading = !failed && (rooms.isPending || devices.isPending);

  return (
    <Screen>
      <View style={[styles.header, { borderColor: c.border }]}>
        <View style={styles.row}>
          <Text style={[styles.brand, { color: c.text }]}>Smart Home</Text>
          <View accessibilityLabel={liveText[live]} style={[styles.dot, { backgroundColor: live === 'live' ? c.ok : live === 'offline' ? c.warn : c.muted }]} />
        </View>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: c.accent, fontWeight: '600' }}>Einstellungen</Text>
          </Pressable>
        </Link>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={rooms.isRefetching || devices.isRefetching} onRefresh={() => void Promise.all([rooms.refetch(), devices.refetch()])} />
        }
      >
        <Confirmations />
        {loading && <Muted>Lade Geräte …</Muted>}
        {failed && <ErrorText>Die Geräte konnten nicht geladen werden. Zum Neuladen nach unten ziehen.</ErrorText>}
        {!loading && !failed && groups.length === 0 && <Muted>Noch keine Geräte. Sobald ein Admin dir Rechte gegeben hat, erscheinen sie hier.</Muted>}
        {groups.map((group) => (
          <View key={group.room?.id ?? 'none'} style={styles.room}>
            <Text style={[styles.roomName, { color: c.text }]}>{group.room?.name ?? 'Ohne Raum'}</Text>
            {group.devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const liveText: Record<LiveStatus, string> = { connecting: 'Verbinde', live: 'Live', offline: 'Offline, verbinde neu' };

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 18, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  content: { padding: 16, gap: 20, paddingBottom: 80 },
  room: { gap: 12 },
  roomName: { fontSize: 17, fontWeight: '700' },
});
