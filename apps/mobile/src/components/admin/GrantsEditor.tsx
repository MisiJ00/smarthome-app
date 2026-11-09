import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { components } from '@smarthome/api-client';
import { actionLabel } from '@smarthome/core';

import { errorText, useCreateGrant, useDeleteGrant, useGrants, useUpdateGrant } from '../../lib/admin';
import { useDevices, useRooms } from '../../lib/api';
import { space } from '../../lib/theme';
import { AppText, Button, Card, Chip, ErrorText, IconButton, Muted, Skeleton } from '../ui';

type Scope = NonNullable<components['schemas']['CreateGrantRequest']['scopeType']>;
type GrantAction = NonNullable<components['schemas']['CreateGrantRequest']['action']>;

const ACTIONS: GrantAction[] = ['view', 'control', 'configure', 'unlock'];
const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: 'all', label: 'Alle Geräte' },
  { id: 'room', label: 'Ein Raum' },
  { id: 'device', label: 'Ein Gerät' },
];

/** The rights of one role or user: list (with approval toggle and remove) and a small form to add one. */
export function GrantsEditor({ subjectType, subjectId, title }: { subjectType: 'role' | 'user'; subjectId: number; title: string }) {
  const grants = useGrants(subjectType, subjectId);
  const rooms = useRooms();
  const devices = useDevices();
  const create = useCreateGrant();
  const update = useUpdateGrant();
  const remove = useDeleteGrant();
  const [action, setAction] = useState<GrantAction>('control');
  const [scope, setScope] = useState<Scope>('all');
  const [scopeId, setScopeId] = useState<number | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');

  const options = scope === 'room' ? (rooms.data ?? []) : scope === 'device' ? (devices.data ?? []) : [];
  const add = () => {
    if (scope !== 'all' && scopeId === undefined) {
      setError(scope === 'room' ? 'Bitte einen Raum wählen.' : 'Bitte ein Gerät wählen.');
      return;
    }
    setError('');
    create.mutate(
      {
        subjectType,
        subjectId,
        scopeType: scope,
        ...(scope !== 'all' ? { scopeId } : {}),
        action,
        requiresConfirmation: confirm || action === 'unlock',
      },
      { onError: (e) => setError(errorText(e)) },
    );
  };

  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="heading">{title}</AppText>
        {grants.isPending && <Skeleton height={48} />}
        {grants.isError && <ErrorText>{errorText(grants.error, 'Die Rechte konnten nicht geladen werden.')}</ErrorText>}
        {grants.data?.length === 0 && <Muted small>Noch keine eigenen Rechte.</Muted>}
        {(grants.data ?? []).map((g) => (
          <View key={g.id} style={styles.grant}>
            <View style={styles.flex}>
              <AppText weight="semibold">{actionLabel(g.action ?? '')}</AppText>
              <Muted small>{g.scopeType === 'all' ? 'Alle Geräte' : g.scopeType === 'room' ? `Raum ${g.scopeName}` : (g.scopeName ?? '')}</Muted>
            </View>
            <Chip
              label="mit Freigabe"
              selected={g.requiresConfirmation ?? false}
              onPress={() => {
                if (g.action !== 'unlock' && !update.isPending) {
                  update.mutate({ id: g.id!, requiresConfirmation: !g.requiresConfirmation }, { onError: (e) => setError(errorText(e)) });
                }
              }}
            />
            <IconButton icon="close" label={`${actionLabel(g.action ?? '')} entfernen`} onPress={() => remove.mutate(g.id!, { onError: (e) => setError(errorText(e)) })} />
          </View>
        ))}

        <AppText weight="semibold">Recht hinzufügen</AppText>
        <View style={styles.chips}>
          {ACTIONS.map((a) => (
            <Chip key={a} label={actionLabel(a)} selected={action === a} onPress={() => setAction(a)} />
          ))}
        </View>
        <View style={styles.chips}>
          {SCOPES.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              selected={scope === s.id}
              onPress={() => {
                setScope(s.id);
                setScopeId(undefined);
              }}
            />
          ))}
        </View>
        {scope !== 'all' && (
          <View style={styles.chips}>
            {options.map((o) => (
              <Chip key={o.id} label={o.name ?? ''} selected={scopeId === o.id} onPress={() => setScopeId(o.id)} />
            ))}
          </View>
        )}
        <Chip label="mit Freigabe" selected={confirm || action === 'unlock'} onPress={() => action !== 'unlock' && setConfirm(!confirm)} />
        <ErrorText>{error}</ErrorText>
        <Button title="Recht hinzufügen" kind="primary" icon="add" busy={create.isPending} onPress={add} />
        <Muted small>Jedes Recht erlaubt auch das Sehen. Aufschließen braucht immer eine Freigabe. Admins brauchen keine Rechte.</Muted>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  flex: { flex: 1 },
  grant: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
