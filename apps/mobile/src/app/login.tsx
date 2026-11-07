import { Link } from 'expo-router';
import { useState } from 'react';

import { AuthScreen, Button, ErrorText, Field, Muted } from '../components/ui';
import { useAuth } from '../lib/auth';

/** Login with email or username and password; with TOTP set up, the second factor follows. */
export default function LoginScreen() {
  const { state } = useAuth();
  return state.status === 'needsSecondFactor' ? <SecondFactor /> : <Password />;
}

function Password() {
  const { state, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(identifier, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Anmelden"
      footer={
        <>
          <Muted small>Server: {'server' in state ? state.server : ''}</Muted>
          <Link href="/server" asChild>
            <Button title="Server ändern" kind="ghost" small onPress={() => {}} />
          </Link>
        </>
      }
    >
      <Field label="E-Mail oder Benutzername" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" />
      <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={() => void submit()} />
      <ErrorText>{error}</ErrorText>
      <Button title="Anmelden" kind="primary" busy={busy} disabled={!identifier || !password} onPress={() => void submit()} />
      <Link href="/setup" asChild>
        <Button title="Neues Konto einrichten" kind="ghost" onPress={() => {}} />
      </Link>
    </AuthScreen>
  );
}

function SecondFactor() {
  const { secondFactor, logout } = useAuth();
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await secondFactor(code, backup);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Zweiter Faktor">
      <Field
        label={backup ? 'Backup-Code' : 'Code aus der Authenticator-App'}
        value={code}
        onChangeText={setCode}
        keyboardType={backup ? 'default' : 'number-pad'}
        autoComplete="one-time-code"
        autoFocus
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Bestätigen" kind="primary" busy={busy} disabled={!code} onPress={() => void submit()} />
      <Button title={backup ? 'Code aus der App verwenden' : 'Backup-Code verwenden'} kind="ghost" onPress={() => setBackup(!backup)} />
      <Button title="Abbrechen" kind="ghost" onPress={() => void logout()} />
    </AuthScreen>
  );
}
