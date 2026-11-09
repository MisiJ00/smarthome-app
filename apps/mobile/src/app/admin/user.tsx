import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { actionLabel } from '@smarthome/core';

import { GrantsEditor } from '../../components/admin/GrantsEditor';
import { SetupCodeCard } from '../../components/admin/SetupCodeCard';
import { AppText, Badge, Button, Card, Chip, ErrorText, Muted, Screen, ScreenHeader, Skeleton, useToast } from '../../components/ui';
import {
  errorText,
  formatTime,
  roleLabel,
  useDeleteUser,
  useEffectivePermissions,
  useNewSetupCode,
  useRevokeTrustedDevice,
  useRoles,
  useSetRoles,
  useTrustedDevices,
  useUpdateUser,
  useUser,
  type SetupCode,
} from '../../lib/admin';
import { space } from '../../lib/theme';

/** One user (admins): roles, active, setup code, own rights, what they may do in effect, phones and browsers. */
export default function UserAdminScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const user = useUser(id);
  const roles = useRoles();
  const setRoles = useSetRoles();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const newCode = useNewSetupCode();
  const toast = useToast();
  const [code, setCode] = useState<SetupCode | null>(null);
  const [error, setError] = useState('');
  const u = user.data?.user;
  const current = u?.roles ?? [];
  const fail = (e: unknown) => setError(errorText(e));

  const confirmDelete = () =>
    Alert.alert(`${u?.name} endgültig löschen?`, 'Das Konto wird auch in Kratos entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => remove.mutate(id, { onSuccess: () => router.back(), onError: fail }) },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={u?.name ?? 'Benutzer'} onBack={() => router.back()} />
        {user.isPending && <Skeleton height={120} />}
        {user.isError && <ErrorText>{errorText(user.error, 'Diesen Benutzer gibt es nicht.')}</ErrorText>}
        {u && (
          <>
            <Card>
              <View style={styles.stack}>
                <View style={styles.titleRow}>
                  <Muted small>{u.machine ? 'Maschinen-User: meldet sich mit API-Token an, kann nicht gelöscht werden.' : [u.username, u.email].filter(Boolean).join(' · ')}</Muted>
                </View>
                <View style={styles.row}>{u.active ? <Badge label="aktiv" tone="ok" /> : <Badge label="deaktiviert" tone="warn" />}</View>
                <AppText weight="semibold">Rollen</AppText>
                <View style={styles.row}>
                  {(roles.data ?? []).map((r) => (
                    <Chip
                      key={r.id}
                      label={roleLabel(r.name)}
                      selected={current.includes(r.name!)}
                      onPress={() =>
                        !setRoles.isPending &&
                        setRoles.mutate({ id, roles: current.includes(r.name!) ? current.filter((n) => n !== r.name) : [...current, r.name!] }, { onError: fail })
                      }
                    />
                  ))}
                </View>
                {!u.machine && (
                  <>
                    <Button
                      title="Neuer Einrichtungscode"
                      icon="rights"
                      disabled={!u.active}
                      busy={newCode.isPending}
                      onPress={() => newCode.mutate(id, { onSuccess: setCode, onError: fail })}
                    />
                    <Button
                      title={u.active ? 'Deaktivieren' : 'Aktivieren'}
                      icon={u.active ? 'offline' : 'check'}
                      busy={update.isPending}
                      onPress={() => update.mutate({ id, body: { active: !u.active } }, { onError: fail })}
                    />
                    <Button title="Löschen" kind="danger" icon="delete" busy={remove.isPending} onPress={confirmDelete} />
                  </>
                )}
                <ErrorText>{error}</ErrorText>
              </View>
            </Card>
            {code && <SetupCodeCard name={u.name ?? ''} code={code} onClose={() => setCode(null)} />}
            <GrantsEditor subjectType="user" subjectId={id} title="Eigene Rechte (zusätzlich zu den Rollen)" />
            <Effective id={id} />
            {!u.machine && <Phones userId={id} onError={(e) => toast('error', errorText(e))} />}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Effective({ id }: { id: number }) {
  const effective = useEffectivePermissions(id);
  const data = effective.data;
  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="heading">Darf effektiv</AppText>
        {effective.isPending && <Skeleton height={48} />}
        {data?.admin && <Muted small>Admin: darf alles, außer gesperrten Aktionen.</Muted>}
        {data && !data.admin && (data.devices ?? []).length === 0 && <Muted small>Darf keine Geräte sehen.</Muted>}
        {(data?.devices ?? []).map((d) => (
          <View key={d.deviceId} style={styles.stack}>
            <AppText weight="semibold">{d.name}</AppText>
            <View style={styles.row}>
              {(d.permissions ?? []).map((p) => (
                <Badge
                  key={p.action}
                  label={actionLabel(p.action ?? '') + (p.requiresConfirmation ? ' (mit Freigabe)' : '')}
                  tone={p.requiresConfirmation ? 'warn' : 'neutral'}
                  icon={p.requiresConfirmation ? 'approval' : undefined}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Phones and browser passkeys that may sign approvals; an admin can block a lost one. */
function Phones({ userId, onError }: { userId: number; onError: (e: unknown) => void }) {
  const phones = useTrustedDevices(userId);
  const revoke = useRevokeTrustedDevice(userId);
  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="heading">Geräte für Freigaben</AppText>
        {phones.isPending && <Skeleton height={48} />}
        {phones.data?.length === 0 && <Muted small>Keine Handys oder Browser registriert.</Muted>}
        {(phones.data ?? []).map((p) => (
          <View key={p.id} style={styles.stack}>
            <View style={styles.titleRow}>
              <AppText weight="semibold" style={styles.flex}>
                {p.name} {p.kind === 'webauthn' ? '(Browser)' : ''}
              </AppText>
              {p.active ? <Badge label="aktiv" tone="ok" /> : <Badge label="gesperrt" tone="danger" />}
            </View>
            <Muted small>
              seit {formatTime(p.createdAt)} · zuletzt benutzt {formatTime(p.lastUsed)}
            </Muted>
            {p.active && (
              <Button
                title="Sperren"
                kind="danger"
                icon="lock"
                small
                busy={revoke.isPending}
                onPress={() =>
                  Alert.alert(`${p.name} sperren?`, 'Damit kann es keine Freigaben mehr unterschreiben.', [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Sperren', style: 'destructive', onPress: () => revoke.mutate(p.id!, { onError }) },
                  ])
                }
              />
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  stack: { gap: space.sm },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
