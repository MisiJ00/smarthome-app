import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorText, Field, Muted, Screen, Title, useToast } from '../components/ui';
import { useMe, useNotifications } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fontSize, useColors } from '../lib/theme';
import { defaultPhoneName, phoneError, usePhone, useRegisterPhone, useRemovePhone } from '../lib/phone';

/** Account, this phone as approval device, server and sign-out. */
export default function SettingsScreen() {
  const { state, logout } = useAuth();
  const me = useMe();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Button title="← Zurück" kind="ghost" onPress={() => router.back()} />
        <Title>Einstellungen</Title>
        <Card>
          <Muted>Angemeldet als</Muted>
          <Title>{me.data?.name ?? '…'}</Title>
          <Muted small>{(me.data?.roles ?? []).join(', ') || 'keine Rolle'}</Muted>
        </Card>
        <PhoneCard />
        <NotificationCard />
        <Card>
          <Muted>Server</Muted>
          <Muted small>{'server' in state ? state.server : ''}</Muted>
        </Card>
        <View style={styles.actions}>
          <Button title="Abmelden" kind="danger" onPress={() => void logout()} />
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
      <Muted>Freigabe per Fingerabdruck</Muted>
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

/** Push messages come through the ntfy app (no Google services needed): it subscribes to this user's secret topic. */
function NotificationCard() {
  const c = useColors();
  const toast = useToast();
  const { data } = useNotifications();
  if (!data?.enabled || !data.server || !data.topic) {
    return null;
  }
  const server = new URL(data.server);
  const link = `ntfy://${server.host}/${data.topic}${server.protocol === 'http:' ? '?secure=false' : ''}`;
  return (
    <Card>
      <Muted>Benachrichtigungen</Muted>
      <Muted small>
        Damit du Freigabe-Anfragen auch bei geschlossener App bekommst, installiere die App „ntfy“ (F-Droid oder GitHub) und abonniere dort dein
        Thema. Tippen auf die Nachricht öffnet diese App.
      </Muted>
      <Button
        title="In ntfy abonnieren"
        kind="primary"
        onPress={() => void Linking.openURL(link).catch(() => toast('error', 'Die ntfy-App ist nicht installiert'))}
      />
      <Text selectable style={{ color: c.muted, fontSize: fontSize.xs }}>
        Server: {data.server}
        {'\n'}Thema: {data.topic}
      </Text>
      <Muted small>Das Thema ist geheim, gib es nicht weiter.</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Extra room at the bottom so "Abmelden" does not end up under the gesture bar
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  actions: { marginTop: 8 },
});
