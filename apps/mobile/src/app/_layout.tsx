import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../components/ui';
import { ApiProvider } from '../lib/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';

export default function RootLayout() {
  const [queries] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ApiProvider>
          <QueryClientProvider client={queries}>
            <ToastProvider>
              <StatusBar style="auto" />
              <Screens />
            </ToastProvider>
          </QueryClientProvider>
        </ApiProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Which screens exist depends on the login state; Expo Router sends the user to an allowed one. */
function Screens() {
  const { state } = useAuth();
  const c = useColors();
  const queries = useQueryClient();
  const signedIn = state.status === 'signedIn';
  // Nothing of one account may be shown to the next one signing in on this phone
  useEffect(() => {
    if (!signedIn) {
      queries.clear();
    }
  }, [signedIn, queries]);
  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn && state.status !== 'noServer'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Screen name="server" />
    </Stack>
  );
}
