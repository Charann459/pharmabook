import '../global.css';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  getMobileDefaultRouteForRole,
  normalizeRole,
  useAuthStore,
  useIsHydrated,
} from '../src/store/auth.store';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash screen is already hidden.
});

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useIsHydrated();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;

    SplashScreen.hideAsync().catch(() => {
      // Ignore if already hidden.
    });

    const group = segments[0];
    const page = segments[1];

    const inAuthGroup = group === '(auth)';
    const inAppGroup = group === '(app)';
    const role = normalizeRole(user?.role);

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuthGroup) {
      router.replace(getMobileDefaultRouteForRole(user.role));
      return;
    }

    if (!user || !inAppGroup || !role) return;

    if (role === 'cashier' && page !== 'billing') {
      router.replace('/(app)/billing');
      return;
    }

    if (role === 'inventory_manager' && page !== 'inventory') {
      router.replace('/(app)/inventory');
    }
  }, [isHydrated, user, segments, router]);

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