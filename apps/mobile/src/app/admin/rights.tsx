import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { GrantsEditor } from '../../components/admin/GrantsEditor';
import { AppText, Button, Card, Chip, ErrorText, Field, Muted, Screen, ScreenHeader, Skeleton } from '../../components/ui';
import { errorText, roleLabel, useCreateRole, useDeleteRole, useRoles } from '../../lib/admin';
import { space } from '../../lib/theme';

/** Admins: roles and their rights (rights of one person are on that user's page). */
export default function RightsAdminScreen() {
  const roles = useRoles();
  const create = useCreateRole();
  const remove = useDeleteRole();
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const current = roles.data?.find((r) => r.id === selected) ?? roles.data?.find((r) => r.name === 'bewohner');
  const validName = /^[a-z0-9_-]{2,32}$/.test(name);

  const confirmDelete = () =>
    current?.id !== undefined &&
    Alert.alert(`Rolle ${current.name} löschen?`, undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => remove.mutate(current.id!, { onSuccess: () => setSelected(null), onError: (e) => setError(errorText(e)) }),
      },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Rollen und Rechte" onBack={() => router.back()} />
        <Card>
          <View style={styles.stack}>
            <AppText variant="heading">Rollen</AppText>
            {roles.isPending && <Skeleton height={44} />}
            {roles.isError && <ErrorText>{errorText(roles.error, 'Die Rollen konnten nicht geladen werden.')}</ErrorText>}
            <View style={styles.row}>
              {(roles.data ?? []).map((r) => (
                <Chip key={r.id} label={`${roleLabel(r.name)} · ${r.userCount ?? 0}`} selected={current?.id === r.id} onPress={() => setSelected(r.id!)} />
              ))}
            </View>
            <Field
              label="Neue Rolle"
              placeholder="z. B. nachbar"
              value={name}
              onChangeText={(t) => setName(t.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={32}
            />
            <Muted small>2 bis 32 Zeichen: Kleinbuchstaben, Ziffern, Bindestrich, Unterstrich.</Muted>
            <Button
              title="Rolle anlegen"
              icon="add"
              busy={create.isPending}
              disabled={!validName}
              onPress={() => {
                setError('');
                create.mutate(name.trim(), { onSuccess: () => setName(''), onError: (e) => setError(errorText(e)) });
              }}
            />
            <ErrorText>{error}</ErrorText>
          </View>
        </Card>
        {current?.id !== undefined &&
          (current.name === 'admin' ? (
            <Card>
              <View style={styles.stack}>
                <AppText variant="heading">Admin</AppText>
                <Muted small>Admins dürfen alles außer gesperrten Aktionen und brauchen keine Rechte.</Muted>
              </View>
            </Card>
          ) : (
            <GrantsEditor key={current.id} subjectType="role" subjectId={current.id} title={`Rechte der Rolle ${roleLabel(current.name)}`} />
          ))}
        {current && !current.system && <Button title={`Rolle ${current.name} löschen`} kind="danger" icon="delete" busy={remove.isPending} onPress={confirmDelete} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  stack: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
