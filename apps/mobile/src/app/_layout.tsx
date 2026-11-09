import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../components/ui';
import { ApiProvider } from '../lib/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { AppearanceProvider, fontFiles, useAppearance, useColors } from '../lib/theme';

// The native splash screen (expo-splash-screen, configured in app.json) stays until Inter is there, so no text jumps
// from the system font to Inter. Called in global scope, as the docs advise, so it is not too late.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 200, fade: true });

export default function RootLayout() {
  // Gestures for the colour picker (reanimated-color-picker) need the root view of gesture-handler
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppearanceProvider>
        <Root />
      </AppearanceProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const [queries] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const { shade, colors: c, ready: appearanceReady } = useAppearance();
  // The splash screen also waits for the stored appearance, so the first frame already has the chosen colours
  const ready = (fontsLoaded || fontError !== null) && appearanceReady;

  useEffect(() => {
    if (ready) {
      // Without the fonts (should not happen, they are bundled) the app still works with the system font
      SplashScreen.hide();
    }
  }, [ready]);

  // The window behind the screens (shows during transitions and behind the keyboard) follows light/dark
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  if (!ready) {
    // Behind the splash screen: the background of the current mode, so dark mode shows no white flash
    return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ApiProvider>
          <QueryClientProvider client={queries}>
            <ToastProvider>
              {/* Dark icons on light ground and the other way round; the app draws edge to edge */}
              <StatusBar style={shade === 'dark' ? 'light' : 'dark'} />
              {/* Button navigation: "dark" = dark bar with light buttons */}
              <NavigationBar style={shade === 'dark' ? 'dark' : 'light'} />
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
        <Stack.Screen name="appearance" />
        <Stack.Screen name="widgets" />
        <Stack.Screen name="admin/rooms" />
        <Stack.Screen name="admin/devices" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/user" />
        <Stack.Screen name="admin/rights" />
        <Stack.Screen name="admin/audit" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn && state.status !== 'noServer'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Screen name="server" />
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
