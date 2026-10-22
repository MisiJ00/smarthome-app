import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ErrorText, Field, Muted, Screen, Title } from '../components/ui';

/**
 * New account: the admin's setup link opens the setup page of the web interface (code, then password). That page
 * already does everything; afterwards the person signs in here.
 */
export default function SetupScreen() {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const open = async () => {
    const url = link.trim();
    if (!/^https?:\/\/.+\/setup\?flow=/.test(url)) {
      setError('Das sieht nicht nach dem Einrichtungslink aus (…/setup?flow=…).');
      return;
    }
    setError('');
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <Screen centered>
      <View style={styles.box}>
        <Title>Konto einrichten</Title>
        <Muted>
          Du hast vom Admin einen Link und einen sechsstelligen Code bekommen. Öffne den Link (oder füge ihn hier ein), gib den Code ein und wähle dein
          Passwort. Danach meldest du dich hier an.
        </Muted>
        <Field label="Einrichtungslink" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <ErrorText>{error}</ErrorText>
        <Button title="Link öffnen" kind="primary" disabled={!link.trim()} onPress={() => void open()} />
        <Button title="Zurück zur Anmeldung" kind="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ box: { gap: 14 } });
