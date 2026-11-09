import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Chip, EmptyState, ErrorText, Muted, Screen, ScreenHeader, Skeleton, type Tone } from '../../components/ui';
import {
  AUDIT_ACTIONS,
  AUDIT_RESULTS,
  AUDIT_VIA,
  auditDescription,
  auditTone,
  errorText,
  formatTime,
  useAudit,
  useUsers,
  type AuditFilter,
} from '../../lib/admin';
import { useDevices } from '../../lib/api';
import { space } from '../../lib/theme';

const PAGE_SIZE = 25;
const TONES: Record<'ok' | 'warn' | 'error', Tone> = { ok: 'ok', warn: 'warn', error: 'danger' };

/** Admins: who did what when, newest first, with filters and pages. */
export default function AuditAdminScreen() {
  const users = useUsers();
  const devices = useDevices();
  const [filter, setFilter] = useState<AuditFilter>({ page: 0, size: PAGE_SIZE });
  const audit = useAudit(filter);
  const set = (patch: Partial<AuditFilter>) => setFilter((f) => ({ ...f, ...patch, page: patch.page ?? 0 }));
  const total = audit.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Protokoll" onBack={() => router.back()} />
        <Filter title="Benutzer" all={filter.userId === undefined} onAll={() => set({ userId: undefined })}>
          {(users.data ?? []).map((u) => (
            <Chip key={u.id} label={u.name ?? ''} selected={filter.userId === u.id} onPress={() => set({ userId: u.id })} />
          ))}
        </Filter>
        <Filter title="Gerät" all={filter.deviceId === undefined} onAll={() => set({ deviceId: undefined })}>
          {(devices.data ?? []).map((d) => (
            <Chip key={d.id} label={d.name ?? ''} selected={filter.deviceId === d.id} onPress={() => set({ deviceId: d.id })} />
          ))}
        </Filter>
        <Filter title="Vorgang" all={filter.action === undefined} onAll={() => set({ action: undefined })}>
          {Object.entries(AUDIT_ACTIONS).map(([value, text]) => (
            <Chip key={value} label={text} selected={filter.action === value} onPress={() => set({ action: value })} />
          ))}
        </Filter>
        <Filter title="Ergebnis" all={filter.result === undefined} onAll={() => set({ result: undefined })}>
          {Object.entries(AUDIT_RESULTS).map(([value, text]) => (
            <Chip key={value} label={text} selected={filter.result === value} onPress={() => set({ result: value as AuditFilter['result'] })} />
          ))}
        </Filter>
        <Filter title="Über" all={filter.via === undefined} onAll={() => set({ via: undefined })}>
          {Object.entries(AUDIT_VIA).map(([value, text]) => (
            <Chip key={value} label={text} selected={filter.via === value} onPress={() => set({ via: value as AuditFilter['via'] })} />
          ))}
        </Filter>

        {audit.isPending && <Skeleton height={80} />}
        {audit.isError && <ErrorText>{errorText(audit.error, 'Das Protokoll konnte nicht geladen werden.')}</ErrorText>}
        {total === 0 && !audit.isPending && !audit.isError && <EmptyState icon="audit" title="Keine Einträge" />}
        <View style={styles.list}>
          {(audit.data?.items ?? []).map((e) => {
            const tone = auditTone(e.result);
            return (
              <Card key={e.id}>
                <View style={styles.stack}>
                  <View style={styles.titleRow}>
                    <AppText weight="semibold" style={styles.flex}>
                      {e.userName ?? '–'}
                      {e.deviceName ? ` · ${e.deviceName}` : ''}
                    </AppText>
                    {e.result && <Badge label={AUDIT_RESULTS[e.result]} tone={tone ? TONES[tone] : 'neutral'} />}
                  </View>
                  <AppText variant="small">{auditDescription(e)}</AppText>
                  <Muted small>
                    {formatTime(e.ts)}
                    {e.via ? ` · ${AUDIT_VIA[e.via]}` : ''}
                  </Muted>
                </View>
              </Card>
            );
          })}
        </View>
        <View style={styles.pager}>
          <Button title="Neuer" kind="ghost" icon="up" small disabled={filter.page === 0} onPress={() => set({ page: filter.page - 1 })} />
          <Muted small>
            Seite {filter.page + 1} von {pages} · {total} Einträge
          </Muted>
          <Button title="Älter" kind="ghost" icon="down" small disabled={filter.page + 1 >= pages} onPress={() => set({ page: filter.page + 1 })} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Filter({ title, all, onAll, children }: { title: string; all: boolean; onAll: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.stack}>
      <Muted small>{title}</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Alle" selected={all} onPress={onAll} />
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  list: { gap: space.sm },
  stack: { gap: space.xs },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
