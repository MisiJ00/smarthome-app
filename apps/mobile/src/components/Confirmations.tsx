import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@smarthome/api-client';

import { useDecide, usePendingConfirmations } from '../lib/api';
import { phoneError, useApproveWithPhone, usePhone } from '../lib/phone';
import { useColors } from '../lib/theme';
import { Button, useToast } from './ui';

/** Open requests: one's own ("waiting for approval") and those one may decide. */
export function Confirmations() {
  const c = useColors();
  const { data } = usePendingConfirmations();
  const decide = useDecide();
  const phone = usePhone();
  const approveWithPhone = useApproveWithPhone();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const pending = (data ?? []).filter((x) => !x.expiresAt || new Date(x.expiresAt).getTime() > now);
  if (pending.length === 0) {
    return null;
  }
  const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Das hat nicht geklappt');
  return (
    <View style={styles.list}>
      {pending.map((x) => (
        <View key={x.id} style={[styles.item, { borderColor: c.warn, backgroundColor: c.surface }]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>
            {x.deviceName}: {x.action === 'unlock' ? 'Öffnen' : 'Schalten'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {x.mine ? 'Deine Anfrage wartet auf Freigabe' : `Anfrage von ${x.userName}`} · noch {remaining(x.expiresAt, now)}
          </Text>
          {(x.canDecide || x.canApproveWithPhone) && x.id !== undefined && (
            <View style={styles.row}>
              {x.canDecide && (
                <Button title="Ablehnen" busy={decide.isPending} onPress={() => decide.mutate({ id: x.id!, approve: false }, { onError: (e) => toast('error', message(e)) })} />
              )}
              {x.canApproveWithPhone && phone.data?.kind === 'registered' ? (
                <Button
                  title="Mit Fingerabdruck freigeben"
                  kind="primary"
                  busy={approveWithPhone.isPending}
                  onPress={() =>
                    approveWithPhone.mutate(
                      { confirmation: x, trustedDeviceId: (phone.data as { trustedDeviceId: number }).trustedDeviceId },
                      { onSuccess: () => toast('success', 'Freigegeben'), onError: (e) => toast('error', phoneError(e)) },
                    )
                  }
                />
              ) : (
                x.canDecide && (
                  <Button
                    title="Freigeben"
                    kind="primary"
                    busy={decide.isPending}
                    onPress={() =>
                      decide.mutate({ id: x.id!, approve: true }, { onSuccess: () => toast('success', 'Freigegeben'), onError: (e) => toast('error', message(e)) })
                    }
                  />
                )
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function remaining(expiresAt: string | undefined, now: number): string {
  if (!expiresAt) {
    return '';
  }
  const seconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  item: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
