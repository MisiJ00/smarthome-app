import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Sheet } from '../../components/admin/Sheet';
import { SetupCodeCard } from '../../components/admin/SetupCodeCard';
import { AppText, Badge, Button, Card, Chip, EmptyState, ErrorText, Field, IconButton, Muted, Screen, ScreenHeader, Skeleton } from '../../components/ui';
import { errorText, roleLabel, useCreateUser, useRoles, useUsers, type CreatedUser } from '../../lib/admin';
import { space } from '../../lib/theme';

/** Admins: all users, new accounts (they get a setup code instead of a password) and the way to one user's page. */
export default function UsersAdminScreen() {
  const users = useUsers();
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Benutzer"
          onBack={() => router.back()}
          right={<IconButton icon="add" label="Neues Konto" kind="primary" onPress={() => setAdding(true)} />}
        />
        {created?.setupCode && <SetupCodeCard name={created.user?.name ?? ''} code={created.setupCode} onClose={() => setCreated(null)} />}
        {users.isPending && <Skeleton height={72} />}
        {users.isError && <ErrorText>{errorText(users.error, 'Die Benutzer konnten nicht geladen werden.')}</ErrorText>}
        {users.data?.length === 0 && <EmptyState icon="account" title="Noch keine Benutzer" />}
        <View style={styles.list}>
          {(users.data ?? []).map((u) => (
            <Card
              key={u.id}
              accessibilityLabel={`${u.name}, bearbeiten`}
              onPress={() => router.push({ pathname: '/admin/user', params: { id: String(u.id) } })}
            >
              <View style={styles.stack}>
                <View style={styles.titleRow}>
                  <AppText variant="heading" numberOfLines={1} style={styles.flex}>
                    {u.name}
                  </AppText>
                  {!u.active && <Badge label="deaktiviert" tone="warn" />}
                </View>
                <Muted small>{u.machine ? 'Maschinen-User (KI, Skripte)' : [u.username, u.email].filter(Boolean).join(' · ')}</Muted>
                <View style={styles.badges}>
                  {(u.roles ?? []).length > 0 ? (
                    (u.roles ?? []).map((r) => <Badge key={r} label={roleLabel(r)} tone={r === 'admin' ? 'accent' : 'neutral'} />)
                  ) : (
                    <Muted small>keine Rolle</Muted>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
      <Sheet visible={adding} title="Neues Konto" onClose={() => setAdding(false)}>
        {adding && (
          <NewUser
            onCreated={(user) => {
              setCreated(user);
              setAdding(false);
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

function NewUser({ onCreated }: { onCreated: (user: CreatedUser) => void }) {
  const roles = useRoles();
  const create = useCreateUser();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>(['bewohner']);
  const [error, setError] = useState('');
  const valid = name.trim() !== '' && /^[a-z0-9._-]{3,32}$/.test(username) && /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = () => {
    if (!valid || create.isPending) {
      return;
    }
    setError('');
    create.mutate({ name: name.trim(), username: username.trim(), email: email.trim(), roles: selected }, { onSuccess: onCreated, onError: (e) => setError(errorText(e)) });
  };

  return (
    <View style={styles.form}>
      <Muted small>Die Person wählt ihr Passwort selbst, mit einem Einrichtungscode.</Muted>
      <Field label="Name" value={name} onChangeText={setName} maxLength={100} autoFocus />
      <Field
        label="Benutzername"
        placeholder="z. B. erika"
        value={username}
        onChangeText={(t) => setUsername(t.toLowerCase())}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={32}
      />
      <Muted small>3 bis 32 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich.</Muted>
      <Field label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <AppText weight="semibold">Rollen</AppText>
      <View style={styles.badges}>
        {(roles.data ?? [])
          .filter((r) => r.name !== 'ki')
          .map((r) => (
            <Chip
              key={r.id}
              label={roleLabel(r.name)}
              selected={selected.includes(r.name!)}
              onPress={() => setSelected(selected.includes(r.name!) ? selected.filter((n) => n !== r.name) : [...selected, r.name!])}
            />
          ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Konto anlegen" kind="primary" busy={create.isPending} disabled={!valid} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  list: { gap: space.md },
  stack: { gap: space.xs },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  form: { gap: space.md },
});
