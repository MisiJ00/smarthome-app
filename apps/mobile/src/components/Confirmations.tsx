import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, type Confirmation } from '@smarthome/api-client';

import { useDecide, usePendingConfirmations } from '../lib/api';
import { phoneError, useApproveWithPhone, usePhone } from '../lib/phone';
import { radius, space, useColors } from '../lib/theme';
import { useConfirmAction } from './devices/ConfirmAction';
import { Icon } from './Icon';
import { AppText, Button, useToast } from './ui';

/**
 * Open requests that the confirm dialog does not handle, as quiet rows above the devices: one's own that was let go
 * ("Bestätigen" brings the dialog back), and the rare ones of others one may decide (e.g. from the AI).
 */
export function Confirmations() {
  const { data } = usePendingConfirmations();
  const confirm = useConfirmAction();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const pending = (data ?? []).filter(
    (x) =>
      (!x.expiresAt || new Date(x.expiresAt).getTime() > now) &&
      x.id !== confirm?.activeId &&
      (x.mine ? confirm !== null : x.canDecide || x.canApproveWithPhone),
  );
  if (pending.length === 0) {
    return null;
  }
  return (
    <View style={styles.list}>
      {pending.map((x) => (
        <Row key={x.id} confirmation={x} now={now} />
      ))}
    </View>
  );
}

function Row({ confirmation: x, now }: { confirmation: Confirmation; now: number }) {
  const c = useColors();
  const confirm = useConfirmAction();
  const decide = useDecide();
  const phone = usePhone();
  const approveWithPhone = useApproveWithPhone();
  const toast = useToast();
  const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Das hat nicht geklappt');
  const what = `${x.deviceName} ${x.action === 'unlock' ? 'öffnen' : 'schalten'}`;
  const left = remaining(x.expiresAt, now);
  return (
    <View accessibilityLiveRegion="polite" style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.text}>
        <Icon name={x.action === 'unlock' ? 'unlock' : 'approval'} size={16} color={x.mine ? c.accent : c.warn} />
        <AppText variant="small" style={styles.flex} numberOfLines={2}>
          {x.mine ? `Deine Anfrage: ${what}` : `${x.userName} möchte ${what}`}
          {left && <AppText variant="small" color={c.muted}>{` · noch ${left}`}</AppText>}
        </AppText>
      </View>
      {x.mine ? (
        <Button title="Bestätigen" small kind="primary" icon="approval" onPress={() => confirm?.resume(x)} />
      ) : (
        x.id !== undefined && (
          <View style={styles.actions}>
            {x.canDecide && (
              <Button
                title="Ablehnen"
                small
                busy={decide.isPending}
                onPress={() => decide.mutate({ id: x.id!, approve: false }, { onError: (e) => toast('error', message(e)) })}
              />
            )}
            {x.canApproveWithPhone && phone.data?.kind === 'registered' ? (
              <Button
                title="Freigeben"
                kind="primary"
                small
                icon="approval"
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
                  small
                  busy={decide.isPending}
                  onPress={() =>
                    decide.mutate({ id: x.id!, approve: true }, { onSuccess: () => toast('success', 'Freigegeben'), onError: (e) => toast('error', message(e)) })
                  }
                />
              )
            )}
          </View>
        )
      )}
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
  list: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.sm, paddingLeft: space.md },
  text: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexGrow: 1, flexBasis: 180 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
});
