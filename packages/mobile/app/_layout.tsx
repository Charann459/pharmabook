// packages/mobile/app/_layout.tsx
import "../global.css"; // <-- This is the magic line that enables Tailwind CSS!

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, useIsHydrated } from '../src/store/auth.store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useIsHydrated();
  const router = useRouter();
  const segments = useSegments();

  // Hydrate auth state from SecureStore/LocalStorage on first mount
  useEffect(() => {
    hydrate();
  }, []);

  // Once hydrated, hide splash and redirect appropriately
  useEffect(() => {
    if (!isHydrated) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not logged in — send to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Logged in — send to app
      router.replace('/(app)');
    }
  }, [isHydrated, user, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}