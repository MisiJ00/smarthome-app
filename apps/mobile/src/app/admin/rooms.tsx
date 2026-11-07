import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Room } from '@smarthome/api-client';
import { sortRooms } from '@smarthome/core';

import { Sheet } from '../../components/admin/Sheet';
import { Icon } from '../../components/Icon';
import { AppText, Button, Card, EmptyState, ErrorText, Field, IconButton, Muted, Screen, ScreenHeader, Skeleton, useToast } from '../../components/ui';
import { errorText, useCreateRoom, useDeleteRoom, useReorderRooms, useUpdateRoom } from '../../lib/admin';
import { useRooms } from '../../lib/api';
import { radius, space, useColors, withAlpha } from '../../lib/theme';

/** Admins: create, rename, sort (arrows) and delete rooms. `?new=1` opens the "new room" sheet right away. */
export default function RoomsAdminScreen() {
  const params = useLocalSearchParams<{ new?: string }>();
  const rooms = useRooms();
  const reorder = useReorderRooms();
  const toast = useToast();
  /** The room being edited, 'new' for a new one, null: no sheet. */
  const [editing, setEditing] = useState<Room | 'new' | null>(params.new ? 'new' : null);
  const list = sortRooms(rooms.data ?? []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) {
      return;
    }
    const ids = list.map((r) => r.id!);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    reorder.mutate(ids, { onError: (e) => toast('error', errorText(e)) });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Räume"
          onBack={() => router.back()}
          right={<IconButton icon="add" label="Raum hinzufügen" kind="primary" onPress={() => setEditing('new')} />}
        />
        {rooms.isPending && (
          <View style={styles.list} accessibilityLabel="Lade Räume …" accessibilityState={{ busy: true }}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        )}
        {rooms.isError && <ErrorText>{errorText(rooms.error, 'Die Räume konnten nicht geladen werden.')}</ErrorText>}
        {rooms.data && list.length === 0 && (
          <Card>
            <EmptyState icon="room" title="Noch keine Räume" text="Lege einen Raum an, um Geräte zu ordnen." />
            <Button title="Raum hinzufügen" kind="primary" icon="add" onPress={() => setEditing('new')} />
          </Card>
        )}
        {list.length > 1 && <Muted small>In dieser Reihenfolge erscheinen die Räume auf der Startseite. Mit den Pfeilen verschiebst du sie.</Muted>}
        <View style={styles.list}>
          {list.map((room, index) => (
            <Card key={room.id} style={styles.card}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${room.name}, ${deviceCount(room)}, bearbeiten`}
                  onPress={() => setEditing(room)}
                  style={({ pressed }) => [styles.main, pressed && styles.pressed]}
                >
                  <AppText variant="heading" numberOfLines={1}>
                    {room.name}
                  </AppText>
                  <Muted small>{deviceCount(room)}</Muted>
                </Pressable>
                <Stepper
                  name={room.name ?? ''}
                  upDisabled={index === 0 || reorder.isPending}
                  downDisabled={index === list.length - 1 || reorder.isPending}
                  onUp={() => move(index, index - 1)}
                  onDown={() => move(index, index + 1)}
                />
                <IconButton icon="edit" label={`${room.name} bearbeiten`} onPress={() => setEditing(room)} />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
      <RoomSheet editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function deviceCount(room: Room): string {
  const n = room.deviceCount ?? 0;
  return n === 0 ? 'Noch leer' : `${n} ${n === 1 ? 'Gerät' : 'Geräte'}`;
}

/** Up/down as one pill with two 44 dp halves, so the pair reads as "move this row". */
function Stepper({
  name,
  upDisabled,
  downDisabled,
  onUp,
  onDown,
}: {
  name: string;
  upDisabled: boolean;
  downDisabled: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.stepper, { backgroundColor: c.surface2, borderColor: withAlpha(c.text, 0.06) }]}>
      <Arrow up label={`${name} nach oben`} disabled={upDisabled} onPress={onUp} />
      <View style={[styles.divider, { backgroundColor: withAlpha(c.text, 0.1) }]} />
      <Arrow label={`${name} nach unten`} disabled={downDisabled} onPress={onDown} />
    </View>
  );
}

function Arrow({ label, up, disabled, onPress }: { label: string; up?: boolean; disabled?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? withAlpha(c.accent, 0.18) : 'transparent', opacity: disabled ? 0.3 : 1 }]}
    >
      <Icon name={up ? 'up' : 'down'} size={22} color={c.text} />
    </Pressable>
  );
}

/** New room or rename/delete an existing one. */
function RoomSheet({ editing, onClose }: { editing: Room | 'new' | null; onClose: () => void }) {
  const room = editing === 'new' || editing === null ? undefined : editing;
  return (
    <Sheet visible={editing !== null} title={room ? 'Raum bearbeiten' : 'Neuer Raum'} onClose={onClose}>
      {/* rebuilt per room, so the form starts with that room's name */}
      {editing !== null && <RoomForm key={room?.id ?? 'new'} room={room} onClose={onClose} />}
    </Sheet>
  );
}

function RoomForm({ room, onClose }: { room: Room | undefined; onClose: () => void }) {
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const toast = useToast();
  const [name, setName] = useState(room?.name ?? '');
  const [error, setError] = useState('');
  const busy = create.isPending || update.isPending || remove.isPending;

  const done = (text: string) => {
    toast('success', text);
    onClose();
  };
  const save = () => {
    if (busy || !name.trim()) {
      return;
    }
    setError('');
    const onError = (e: unknown) => setError(errorText(e));
    if (room) {
      update.mutate({ id: room.id!, body: { name: name.trim() } }, { onError, onSuccess: () => done('Gespeichert') });
    } else {
      create.mutate({ name: name.trim() }, { onError, onSuccess: () => done(`${name.trim()} angelegt`) });
    }
  };
  const confirmDelete = () => {
    if (!room) {
      return;
    }
    // only empty rooms can be deleted; the backend says so as well
    const hint = room.deviceCount ? `Der Raum hat noch ${room.deviceCount} Geräte; er lässt sich erst löschen, wenn er leer ist.` : undefined;
    Alert.alert(`Raum ${room.name} löschen?`, hint, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => {
          setError('');
          remove.mutate(room.id!, { onSuccess: () => done(`${room.name} gelöscht`), onError: (e) => setError(errorText(e)) });
        },
      },
    ]);
  };

  return (
    <View style={styles.form}>
      <Field
        label="Name des Raums"
        placeholder="z. B. Küche"
        value={name}
        onChangeText={setName}
        maxLength={64}
        autoFocus={!room}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={room ? 'Speichern' : 'Anlegen'} kind="primary" busy={create.isPending || update.isPending} disabled={busy || !name.trim()} onPress={save} />
      {room && <Button title="Raum löschen" kind="danger" icon="delete" busy={remove.isPending} disabled={busy} onPress={confirmDelete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  list: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  card: { paddingVertical: space.md, paddingRight: space.sm },
  main: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, overflow: 'hidden' },
  divider: { width: 1, height: 20 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  form: { gap: space.md },
});
