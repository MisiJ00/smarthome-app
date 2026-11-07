import { router } from 'expo-router';
import { useState } from 'react';

import { AuthScreen, Button, ErrorText, Field, Muted } from '../components/ui';
import { useAuth } from '../lib/auth';
import { DEV_SERVER, normalizeServer } from '../lib/server';

/** Address of the home server (the web interface's address: it also serves /api and /kratos). */
export default function ServerScreen() {
  const { state, setServer } = useAuth();
  const [url, setUrl] = useState('server' in state ? state.server : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    const server = normalizeServer(url);
    try {
      const response = await fetch(`${server}/kratos/health/alive`);
      if (!response.ok) {
        throw new Error();
      }
      await setServer(server);
      router.replace('/login');
    } catch {
      setError('Unter dieser Adresse antwortet kein Smart-Home-Server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Server">
      <Muted>Adresse deines Home Servers, wie im Browser, z. B. https://smarthome.example.de.</Muted>
      <Field
        label="Adresse"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://…"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Speichern" kind="primary" busy={busy} disabled={!url.trim()} onPress={() => void save()} />
      {__DEV__ && <Button title={`Entwicklung: ${DEV_SERVER}`} kind="ghost" onPress={() => setUrl(DEV_SERVER)} />}
    </AuthScreen>
  );
}
