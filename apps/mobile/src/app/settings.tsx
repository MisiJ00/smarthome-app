import { router } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { palettes } from '@smarthome/theme';

import { Icon } from '../components/Icon';
import { AppText, Button, Card, ErrorText, Field, IconCircle, Muted, Screen, ScreenHeader, useToast, type Tone } from '../components/ui';
import { useIsAdmin } from '../lib/admin';
import { useMe } from '../lib/api';
import { useAuth } from '../lib/auth';
import { modeNames, space, useAppearance, useColors, type IconName } from '../lib/theme';
import { defaultPhoneName, phoneError, usePhone, useRegisterPhone, useRemovePhone } from '../lib/phone';

/** Account, appearance, this phone as approval device, server and sign-out. */
export default function SettingsScreen() {
  const { state, logout } = useAuth();
  const me = useMe();
  const c = useColors();
  const isAdmin = useIsAdmin();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Einstellungen" onBack={() => router.back()} />
        <Card>
          <View style={styles.account}>
            <IconCircle icon="account" tone="accent" size={48} />
            <View style={styles.flex}>
              <Muted small>Angemeldet als</Muted>
              <AppText variant="heading" numberOfLines={1}>
                {me.data?.name ?? '…'}
              </AppText>
              <Muted small>{(me.data?.roles ?? []).join(', ') || 'keine Rolle'}</Muted>
            </View>
          </View>
        </Card>
        <AppearanceRow />
        {isAdmin && <AdminRows />}
        <PhoneCard />
        <Card>
          <SectionTitle icon="room" title="Server" />
          <AppText variant="small" color={c.muted} selectable>
            {'server' in state ? state.server : ''}
          </AppText>
        </Card>
        <View style={styles.actions}>
          <Button title="Abmelden" kind="danger" icon="logout" onPress={() => void logout()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function PhoneCard() {
  const phone = usePhone();
  const register = useRegisterPhone();
  const remove = useRemovePhone();
  const toast = useToast();
  const [name, setName] = useState(defaultPhoneName);
  const [error, setError] = useState('');

  const state = phone.data;
  return (
    <Card>
      <SectionTitle icon="approval" title="Freigabe per Fingerabdruck" tone={state?.kind === 'registered' ? 'ok' : 'accent'} />
      {!state && <Muted small>{phone.isError ? phoneError(phone.error) : 'Prüfe …'}</Muted>}
      {state?.kind === 'unsupported' && <Muted small>{state.reason}</Muted>}
      {state?.kind === 'registered' && (
        <>
          <Muted small>Dieses Handy ({state.name}) ist eingerichtet. Anfragen kannst du mit deinem Fingerabdruck freigeben, auch deine eigenen.</Muted>
          <Button
            title="Handy entfernen"
            kind="danger"
            busy={remove.isPending}
            onPress={() => remove.mutate(state.trustedDeviceId, { onSuccess: () => toast('success', 'Handy entfernt'), onError: (e) => setError(phoneError(e)) })}
          />
        </>
      )}
      {state?.kind === 'none' && (
        <>
          <Muted small>
            Richte dieses Handy ein, um Anfragen (z. B. die Tür) mit deinem Fingerabdruck freizugeben. Der Schlüssel bleibt im Handy; wer einen neuen
            Fingerabdruck hinzufügt, macht ihn ungültig.
          </Muted>
          <Field label="Name des Handys" value={name} onChangeText={setName} />
          <Button
            title="Handy einrichten"
            kind="primary"
            busy={register.isPending}
            disabled={!name.trim()}
            onPress={() => {
              setError('');
              register.mutate(name.trim(), { onSuccess: () => toast('success', 'Handy eingerichtet'), onError: (e) => setError(phoneError(e)) });
            }}
          />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

/** Admins only: the way to rooms, devices, users, rights and the audit log. */
function AdminRows() {
  const c = useColors();
  const rows: Array<{ icon: IconName; title: string; text: string; href: '/admin/rooms' | '/admin/devices' | '/admin/users' | '/admin/rights' | '/admin/audit' }> = [
    { icon: 'room', title: 'Räume', text: 'Anlegen, umbenennen, sortieren', href: '/admin/rooms' },
    { icon: 'pairing', title: 'Geräte einrichten', text: 'Anlernen, übernehmen, bearbeiten', href: '/admin/devices' },
    { icon: 'account', title: 'Benutzer', text: 'Konten anlegen, Einrichtungscode, Handys sperren', href: '/admin/users' },
    { icon: 'rights', title: 'Rollen und Rechte', text: 'Wer darf was', href: '/admin/rights' },
    { icon: 'audit', title: 'Protokoll', text: 'Wer hat wann was gemacht', href: '/admin/audit' },
  ];
  return (
    <View style={styles.group}>
      <AppText variant="small" weight="semibold" color={c.muted}>
        Verwaltung
      </AppText>
      {rows.map((row) => (
        <Pressable
          key={row.href}
          accessibilityRole="button"
          accessibilityLabel={row.title}
          onPress={() => router.push(row.href)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card>
            <View style={styles.section}>
              <IconCircle icon={row.icon} tone="accent" size={34} />
              <View style={styles.flex}>
                <AppText weight="semibold">{row.title}</AppText>
                <Muted small>{row.text}</Muted>
              </View>
              <Icon name="next" size={20} color={c.muted} />
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

/** Row to the appearance screen, with the current colour world and mode. */
function AppearanceRow() {
  const c = useColors();
  const { appearance } = useAppearance();
  const palette = appearance.palette === 'custom' ? 'Eigene Farben' : palettes[appearance.palette].name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Darstellung: ${palette}, ${modeNames[appearance.mode]}`}
      onPress={() => router.push('/appearance')}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card>
        <View style={styles.section}>
          <IconCircle icon="appearance" tone="accent" size={34} />
          <View style={styles.flex}>
            <AppText weight="semibold">Darstellung</AppText>
            <Muted small>
              {palette} · {modeNames[appearance.mode]} · {appearance.style === 'vivid' ? 'Kräftig' : 'Ruhig'}
            </Muted>
          </View>
          <Icon name="next" size={20} color={c.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

/** Heading of a settings card: tinted icon and title. */
function SectionTitle({ icon, title, tone = 'accent' }: { icon: IconName; title: string; tone?: Tone }): ReactNode {
  return (
    <View style={styles.section}>
      <IconCircle icon={icon} tone={tone} size={34} />
      <AppText weight="semibold" style={styles.flex}>
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  // Extra room at the bottom so "Abmelden" does not end up under the gesture bar
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  actions: { marginTop: space.sm },
  flex: { flex: 1, minWidth: 0 },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  group: { gap: space.sm },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
