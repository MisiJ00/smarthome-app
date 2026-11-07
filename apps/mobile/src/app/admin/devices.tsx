import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import type { Device, Room } from '@smarthome/api-client';
import { actionLabel } from '@smarthome/core';

import { CountdownRing } from '../../components/admin/CountdownRing';
import { FoundCard } from '../../components/admin/FoundCard';
import { RoomPick } from '../../components/admin/RoomPick';
import { Sheet } from '../../components/admin/Sheet';
import { typeIcon, typeLabel } from '../../components/devices/meta';
import { Icon } from '../../components/Icon';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorText,
  Field,
  GradientFill,
  IconCircle,
  Muted,
  Screen,
  ScreenHeader,
  Skeleton,
  useToast,
} from '../../components/ui';
import {
  errorText,
  lockableActions,
  PAIRING_SECONDS,
  secondsUntil,
  useAddDevice,
  useDiscovered,
  usePairing,
  useRemoveDevice,
  useStartPairing,
  useStopPairing,
  useUpdateDevice,
  type Discovered,
} from '../../lib/admin';
import { useDevices, useRooms } from '../../lib/api';
import { space, useColors, useVivid, glowShadow } from '../../lib/theme';

/** Admins: open pairing, adopt newly found devices (name and room), edit or remove the devices that exist. */
export default function DevicesAdminScreen() {
  const c = useColors();
  const rooms = useRooms();
  const devices = useDevices();
  const discovered = useDiscovered();
  const [adopting, setAdopting] = useState<Discovered | null>(null);
  const [editing, setEditing] = useState<Device | null>(null);
  const roomList = rooms.data ?? [];
  const list = [...(devices.data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'));
  const found = discovered.data ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Geräte einrichten" onBack={() => router.back()} />
        <PairingCard />

        {found.length > 0 && (
          <View style={styles.section} accessibilityLiveRegion="polite">
            <SectionHead title="Neu gefunden" count={found.length} />
            {found.map((d) => (
              <FoundCard key={`${d.adapter}/${d.externalId}`} device={d} onAdopt={() => setAdopting(d)} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <SectionHead title="Deine Geräte" count={devices.data ? list.length : undefined} />
          {devices.isPending && (
            <View style={styles.section} accessibilityLabel="Lade Geräte …" accessibilityState={{ busy: true }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
            </View>
          )}
          {devices.isError && <ErrorText>{errorText(devices.error, 'Die Geräte konnten nicht geladen werden.')}</ErrorText>}
          {devices.data && list.length === 0 && (
            <Card>
              <EmptyState icon="device" title="Noch keine Geräte" text="Starte oben die Suche. Gefundene Geräte übernimmst du dann mit Name und Raum." />
            </Card>
          )}
          {list.map((device) => {
            const room = roomList.find((r) => r.id === device.roomId);
            const locked = device.lockedActions ?? [];
            return (
              <Card key={device.id} onPress={() => setEditing(device)} accessibilityLabel={`${device.name} bearbeiten`}>
                <View style={styles.row}>
                  <IconCircle icon={typeIcon(device.type)} />
                  <View style={styles.main}>
                    <AppText weight="semibold" numberOfLines={2}>
                      {device.name}
                    </AppText>
                    <Muted small>
                      {room?.name ?? 'Ohne Raum'} · {typeLabel(device.type)}
                    </Muted>
                  </View>
                  {locked.length > 0 && <Badge label={`${locked.length} gesperrt`} tone="warn" icon="lock" />}
                  <Icon name="next" size={18} color={c.muted} />
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
      <AdoptSheet device={adopting} rooms={roomList} onClose={() => setAdopting(null)} />
      <EditSheet device={editing} rooms={roomList} onClose={() => setEditing(null)} />
    </Screen>
  );
}

/** Seconds until `until`, counted down every second (0 without a time). */
function useSecondsLeft(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return secondsUntil(until, now);
}

/** "Neues Gerät suchen": starts pairing for PAIRING_SECONDS; while it runs a ring counts down, with "Stopp". */
function PairingCard() {
  const c = useColors();
  const vivid = useVivid();
  const pairing = usePairing();
  const start = useStartPairing();
  const stop = useStopPairing();
  const toast = useToast();
  const left = useSecondsLeft(pairing.data?.active ? pairing.data.endsAt : undefined);
  const active = Boolean(pairing.data?.active) && left > 0;

  return (
    <Card highlight={active ? c.accent : undefined} style={active && glowShadow(c.accent, vivid)}>
      {pairing.isError && <ErrorText>{errorText(pairing.error, 'Der Anlernmodus ist nicht erreichbar.')}</ErrorText>}
      {active ? (
        <>
          <View style={styles.live} accessibilityLiveRegion="polite">
            <CountdownRing progress={left / PAIRING_SECONDS} seconds={left} />
            <AppText variant="heading" style={styles.centerText}>
              Bereit zum Verbinden
            </AppText>
            <AppText variant="small" color={c.muted} style={styles.centerText}>
              Versetze das Gerät in den Kopplungsmodus, meist durch langes Drücken der Taste oder mehrmaliges Ein- und Ausschalten. Es erscheint unten, sobald es erkannt ist.
            </AppText>
          </View>
          <Button
            title="Suche beenden"
            kind="danger"
            icon="close"
            busy={stop.isPending}
            onPress={() => stop.mutate(undefined, { onError: (e) => toast('error', errorText(e)) })}
          />
        </>
      ) : (
        <>
          <View style={styles.row}>
            <GradientFill style={[styles.hero, glowShadow(c.accent, vivid)]}>
              <Icon name="pairing" size={28} color={c.accentText} />
            </GradientFill>
            <View style={styles.main}>
              <AppText variant="heading">Neue Geräte anlernen</AppText>
              <Muted small>Gut vier Minuten lang können sich neue Zigbee-Geräte verbinden.</Muted>
            </View>
          </View>
          {pairing.data?.known === false && <Banner tone="warn" icon="offline" title="Zigbee2MQTT hat sich noch nicht gemeldet" />}
          <Button
            title="Neues Gerät suchen"
            kind="primary"
            icon="search"
            busy={start.isPending}
            onPress={() => start.mutate(PAIRING_SECONDS, { onError: (e) => toast('error', errorText(e, 'Zigbee2MQTT antwortet nicht')) })}
          />
        </>
      )}
    </Card>
  );
}

/** Heading of a list with its count in muted type, like the room headings on the home screen. */
function SectionHead({ title, count }: { title: string; count?: number }) {
  const c = useColors();
  return (
    <View style={styles.head} accessibilityRole="header">
      <AppText variant="heading">{title}</AppText>
      {count !== undefined && (
        <AppText variant="small" color={c.muted} tabular>
          {count}
        </AppText>
      )}
    </View>
  );
}

/** Name and room for a newly found device. */
function AdoptSheet({ device, rooms, onClose }: { device: Discovered | null; rooms: Room[]; onClose: () => void }) {
  return (
    <Sheet visible={device !== null} title="Gerät übernehmen" onClose={onClose}>
      {device && <AdoptForm key={`${device.adapter}/${device.externalId}`} device={device} rooms={rooms} onClose={onClose} />}
    </Sheet>
  );
}

function AdoptForm({ device, rooms, onClose }: { device: Discovered; rooms: Room[]; onClose: () => void }) {
  const add = useAddDevice();
  const toast = useToast();
  const [name, setName] = useState(device.suggestedName ?? '');
  const [roomId, setRoomId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    add.mutate(
      { adapter: device.adapter ?? '', externalId: device.externalId ?? '', name: name.trim(), ...(roomId !== null ? { roomId } : {}) },
      {
        onSuccess: () => {
          toast('success', `${name.trim()} übernommen`);
          onClose();
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  return (
    <View style={styles.form}>
      <Muted small>{[device.vendor, device.model, typeLabel(device.type), device.externalId].filter(Boolean).join(' · ')}</Muted>
      <Field label="Name" value={name} onChangeText={setName} maxLength={64} returnKeyType="done" />
      <RoomPick rooms={rooms} value={roomId} onChange={setRoomId} />
      <ErrorText>{error}</ErrorText>
      <Button title="Übernehmen" kind="primary" icon="check" busy={add.isPending} disabled={!name.trim()} onPress={submit} />
    </View>
  );
}

/** Edit name, room and locked actions of an existing device, or remove it. */
function EditSheet({ device, rooms, onClose }: { device: Device | null; rooms: Room[]; onClose: () => void }) {
  return (
    <Sheet visible={device !== null} title="Bearbeiten" onClose={onClose}>
      {device && <EditForm key={device.id} device={device} rooms={rooms} onClose={onClose} />}
    </Sheet>
  );
}

function EditForm({ device, rooms, onClose }: { device: Device; rooms: Room[]; onClose: () => void }) {
  const update = useUpdateDevice();
  const remove = useRemoveDevice();
  const toast = useToast();
  const [name, setName] = useState(device.name ?? '');
  const [roomId, setRoomId] = useState<number | null>(device.roomId ?? null);
  const [locked, setLocked] = useState<string[]>(device.lockedActions ?? []);
  const [error, setError] = useState('');
  const actions = lockableActions(device);

  const save = () => {
    setError('');
    update.mutate(
      // no room: null (the field is optional in the generated type, but the backend takes null to clear it)
      { id: device.id!, body: { name: name.trim(), roomId: roomId ?? (null as unknown as number), lockedActions: locked } },
      {
        onSuccess: () => {
          toast('success', 'Gespeichert');
          onClose();
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };
  const confirmRemove = () =>
    Alert.alert(`${device.name} entfernen?`, 'Es taucht dann wieder unter „Gefunden“ auf, sobald es sich meldet.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: () => {
          setError('');
          remove.mutate(device.id!, {
            onSuccess: () => {
              toast('success', `${device.name} entfernt`);
              onClose();
            },
            onError: (e) => setError(errorText(e)),
          });
        },
      },
    ]);

  return (
    <View style={styles.form}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={64} returnKeyType="done" />
      <RoomPick rooms={rooms} value={roomId} onChange={setRoomId} />
      {actions.length > 0 && (
        <View style={styles.form}>
          <AppText variant="small" weight="medium">
            Gesperrte Aktionen
          </AppText>
          <Muted small>Gelten für alle, auch Admins und die KI.</Muted>
          <View style={styles.chips}>
            {actions.map((action) => (
              <Chip
                key={action}
                label={actionLabel(action)}
                icon={locked.includes(action) ? 'lock' : undefined}
                selected={locked.includes(action)}
                onPress={() => setLocked(locked.includes(action) ? locked.filter((a) => a !== action) : [...locked, action])}
              />
            ))}
          </View>
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Speichern" kind="primary" busy={update.isPending} disabled={remove.isPending || !name.trim()} onPress={save} />
      <Button title="Gerät entfernen" kind="danger" icon="delete" busy={remove.isPending} disabled={update.isPending} onPress={confirmRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 48 },
  section: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  main: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.xs },
  hero: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  live: { alignItems: 'center', gap: space.sm },
  centerText: { textAlign: 'center' },
  form: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
