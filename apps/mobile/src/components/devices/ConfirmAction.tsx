import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, type Confirmation, type Device } from '@smarthome/api-client';
import { commandIntent, type CommandIntent } from '@smarthome/core';

import { useCommand, useDecide, usePendingConfirmations } from '../../lib/api';
import { defaultPhoneName, phoneError, useApproveWithPhone, usePhone, useRegisterPhone } from '../../lib/phone';
import { raisedShadow, space, useColors, useScheme, withAlpha } from '../../lib/theme';
import { AppText, Button, IconCircle, useToast } from '../ui';
import { rejectFeedback, successFeedback } from './haptics';

/*
 * The person confirms their own request themselves: "Wirklich öffnen?" → the request is created → its challenge is
 * signed with the fingerprint (the phone's key, lib/phone.ts) → the backend sends the command. All in one go, no one
 * else needs to approve. Own requests made elsewhere (web) are picked up when they arrive and confirmed the same way.
 */

interface Flow {
  deviceId?: number;
  deviceName: string;
  intent: Pick<CommandIntent, 'action' | 'question' | 'verb' | 'done'>;
  /** The command; undefined when confirming an existing request. */
  body?: Record<string, unknown>;
  /** Set once the request exists. */
  confirmationId?: number;
  phase: 'ask' | 'working' | 'register' | 'unsupported' | 'failed';
  message?: string;
  /** Came from elsewhere (web): the fingerprint is asked for right away. */
  resumed?: boolean;
}

interface ConfirmApi {
  /** Asks "Wirklich …?" and then sends the command, approved with the fingerprint. */
  ask: (device: Device, body: Record<string, unknown>) => void;
  /** Confirms an own open request (e.g. made in the web). */
  resume: (confirmation: Confirmation) => void;
  /** The request the dialog is busy with, so the banner leaves it out. */
  activeId: number | undefined;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

/** null outside of {@link ConfirmProvider}; the callers then send directly (the old way, waiting for others). */
export function useConfirmAction(): ConfirmApi | null {
  return useContext(ConfirmContext);
}

function intentOf(confirmation: Confirmation) {
  return confirmation.action === 'unlock'
    ? { action: 'unlock' as const, question: 'Wirklich öffnen?', verb: 'Öffnen', done: 'Tür geöffnet' }
    : { action: 'control' as const, question: 'Wirklich ausführen?', verb: 'Bestätigen', done: `${confirmation.deviceName}: erledigt` };
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const command = useCommand();
  const phone = usePhone();
  const register = useRegisterPhone();
  const approve = useApproveWithPhone();
  const decide = useDecide();
  const pending = usePendingConfirmations();
  const toast = useToast();
  const [flow, setFlow] = useState<Flow | null>(null);
  /** Requests this dialog already took care of (created, confirmed or let go): not picked up again. */
  const handled = useRef(new Set<number>());
  /** A run is under way: a second tap on "Bestätigen" must not create a second request. */
  const inFlight = useRef(false);

  /** Takes back an own request that exists already (the backend lets the requester withdraw it). */
  const withdraw = useCallback(
    (id: number | undefined) => {
      if (id !== undefined) {
        decide.mutate({ id, approve: false }, { onError: () => {} });
      }
    },
    [decide],
  );
  const close = useCallback(() => {
    // "Abbrechen"/"Schließen" after the request was made (e.g. the fingerprint failed): it is withdrawn
    withdraw(flow?.confirmationId);
    setFlow(null);
  }, [withdraw, flow?.confirmationId]);

  /**
   * The command call failed without a usable answer (e.g. the connection dropped after the backend created the
   * request): take back own open requests for this device that this dialog does not know about.
   */
  const withdrawStray = useCallback(
    async (deviceId: number) => {
      const open = (await pending.refetch()).data ?? [];
      for (const x of open) {
        if (x.mine && x.status === 'pending' && x.deviceId === deviceId && x.id !== undefined && !handled.current.has(x.id)) {
          handled.current.add(x.id);
          withdraw(x.id);
        }
      }
    },
    [pending, withdraw],
  );

  /** Creates the request (if not yet) and approves it with the fingerprint. */
  const run = useCallback(
    async (start: Flow) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      let f: Flow = { ...start, phase: 'working', message: undefined };
      setFlow(f);
      try {
        const state = phone.data ?? (await phone.refetch()).data;
        if (!state || state.kind === 'unsupported') {
          setFlow({ ...f, phase: 'unsupported', message: state?.kind === 'unsupported' ? state.reason : undefined });
          return;
        }
        if (state.kind === 'none') {
          setFlow({ ...f, phase: 'register' });
          return;
        }
        let id = f.confirmationId;
        if (id === undefined) {
          const result = await command.mutateAsync({ deviceId: f.deviceId!, command: f.body! });
          if (result.status !== 'confirmation_required' || result.confirmationId == null) {
            // no approval needed after all: done
            successFeedback();
            toast('success', f.intent.done);
            setFlow(null);
            return;
          }
          id = result.confirmationId;
          handled.current.add(id);
          f = { ...f, confirmationId: id };
          setFlow(f);
        }
        await approve.mutateAsync({
          confirmation: { id, deviceName: f.deviceName, action: f.intent.action },
          trustedDeviceId: state.trustedDeviceId,
        });
        successFeedback();
        toast('success', f.intent.done);
        setFlow(null);
      } catch (e) {
        if ((e as { code?: string } | null)?.code === 'CANCELLED') {
          // Fingerprint cancelled: the request is withdrawn, nothing is left open
          withdraw(f.confirmationId);
          setFlow(null);
          toast('info', f.intent.action === 'unlock' ? 'Abgebrochen, die Tür bleibt zu' : 'Abgebrochen');
          return;
        }
        if (f.confirmationId === undefined && f.deviceId !== undefined && !(e instanceof ApiError)) {
          // the request may exist although the call threw: do not leave it open
          void withdrawStray(f.deviceId).catch(() => {});
        }
        rejectFeedback();
        setFlow({ ...f, phase: 'failed', message: phoneError(e) });
      } finally {
        inFlight.current = false;
      }
    },
    [phone, command, approve, toast, withdraw, withdrawStray],
  );

  const ask = useCallback((device: Device, body: Record<string, unknown>) => {
    const intent = commandIntent(device, body);
    setFlow({ deviceId: device.id, deviceName: device.name ?? 'Gerät', intent, body, phase: 'ask' });
  }, []);

  const resume = useCallback(
    (confirmation: Confirmation) => {
      if (confirmation.id === undefined) {
        return;
      }
      handled.current.add(confirmation.id);
      void run({ deviceName: confirmation.deviceName ?? 'Gerät', intent: intentOf(confirmation), confirmationId: confirmation.id, phase: 'working', resumed: true });
    },
    [run],
  );

  // An own open request from elsewhere (web, widget): confirm it here, once
  useEffect(() => {
    if (flow) {
      return;
    }
    const open = (pending.data ?? []).find(
      (x) => x.mine && x.status === 'pending' && x.id !== undefined && !handled.current.has(x.id) && (!x.expiresAt || new Date(x.expiresAt).getTime() > Date.now()),
    );
    if (open) {
      resume(open);
    }
  }, [pending.data, flow, resume]);

  const registerAndRun = async () => {
    if (!flow) {
      return;
    }
    try {
      setFlow({ ...flow, phase: 'working', message: 'Richte dieses Handy ein …' });
      await register.mutateAsync(defaultPhoneName());
      await phone.refetch();
      await run({ ...flow, phase: 'working' });
    } catch (e) {
      setFlow({ ...flow, phase: 'failed', message: phoneError(e) });
    }
  };

  const api = useMemo<ConfirmApi>(() => ({ ask, resume, activeId: flow?.confirmationId }), [ask, resume, flow?.confirmationId]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <ConfirmSheet flow={flow} onCancel={close} onConfirm={() => flow && void run(flow)} onRegister={() => void registerAndRun()} />
    </ConfirmContext.Provider>
  );
}

function ConfirmSheet({ flow, onCancel, onConfirm, onRegister }: { flow: Flow | null; onCancel: () => void; onConfirm: () => void; onRegister: () => void }) {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const working = flow?.phase === 'working';
  return (
    <Modal
      visible={flow !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      // Android back: like "Abbrechen", but not while the request is under way
      onRequestClose={() => {
        if (!working) {
          onCancel();
        }
      }}
    >
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Abbrechen" disabled={working} onPress={onCancel} />
        {flow && (
          <View
            accessibilityViewIsModal
            style={[styles.sheet, raisedShadow[scheme], { backgroundColor: c.surface, borderColor: withAlpha(c.text, 0.08), paddingBottom: insets.bottom + space.xl }]}
          >
            <View style={[styles.grip, { backgroundColor: withAlpha(c.text, 0.18) }]} />
            <View style={styles.head}>
              <IconCircle icon={flow.intent.action === 'unlock' ? 'unlock' : 'approval'} tone={flow.phase === 'failed' ? 'danger' : 'accent'} size={52} />
              <View style={styles.headText}>
                <AppText variant="small" color={c.muted}>
                  {flow.resumed ? 'Deine Anfrage' : flow.intent.verb}
                </AppText>
                <AppText variant="heading" numberOfLines={2}>
                  {flow.deviceName}
                </AppText>
              </View>
            </View>
            <AppText variant="title" accessibilityRole="header">
              {flow.intent.question}
            </AppText>
            <Body flow={flow} />
            <View style={styles.actions}>
              {flow.phase !== 'working' && (
                <View style={styles.cell}>
                  <Button title={flow.phase === 'ask' || flow.phase === 'register' ? 'Abbrechen' : 'Schließen'} onPress={onCancel} />
                </View>
              )}
              {(flow.phase === 'ask' || flow.phase === 'failed') && (
                <View style={styles.cell}>
                  <Button title={flow.phase === 'failed' ? 'Nochmal' : flow.intent.verb} kind="primary" icon="approval" onPress={onConfirm} />
                </View>
              )}
              {flow.phase === 'register' && (
                <View style={styles.cellWide}>
                  <Button title="Dieses Handy einrichten" kind="primary" icon="phone" onPress={onRegister} />
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Body({ flow }: { flow: Flow }) {
  const c = useColors();
  // read only (cached query): the question names the step that really comes next
  const phone = usePhone().data;
  switch (flow.phase) {
    case 'working':
      return (
        <View style={styles.working} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.accent} />
          <AppText color={c.muted}>{flow.message ?? (flow.confirmationId === undefined ? 'Anfrage wird gesendet …' : 'Bestätige mit deinem Fingerabdruck …')}</AppText>
        </View>
      );
    case 'register':
      return (
        <AppText color={c.muted}>
          Zum Bestätigen braucht dieses Handy einen Schlüssel, der nur mit deinem Fingerabdruck funktioniert. Einmal einrichten, dann geht es hier
          sofort weiter.
        </AppText>
      );
    case 'unsupported':
      return <AppText color={c.muted}>{flow.message ?? 'Auf diesem Handy kannst du nicht mit Fingerabdruck bestätigen.'}</AppText>;
    case 'failed':
      return (
        <AppText color={c.danger} accessibilityLiveRegion="polite">
          {flow.message}
        </AppText>
      );
    default:
      return <AppText color={c.muted}>{askText(phone)}</AppText>;
  }
}

/** What happens after the main button, by the state of this phone. */
function askText(phone: ReturnType<typeof usePhone>['data']): string {
  switch (phone?.kind) {
    case 'registered':
      return 'Du bestätigst gleich mit deinem Fingerabdruck. Niemand sonst muss zustimmen.';
    case 'none':
      return 'Dafür richtest du dieses Handy einmal mit deinem Fingerabdruck ein. Danach geht es sofort weiter.';
    case 'unsupported':
      return phone.reason;
    default:
      return 'Das bestätigst du mit deinem Fingerabdruck. Niemand sonst muss zustimmen.';
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  // the same sheet as the device details: 28 dp corners, hairline, grip
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: space.xl, paddingTop: 10, gap: space.lg },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1, minWidth: 0 },
  working: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  cell: { flexGrow: 1, flexBasis: 120 },
  cellWide: { flexGrow: 2, flexBasis: 200 },
});
