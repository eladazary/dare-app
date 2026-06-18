import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { usePushNotifications } from '@/hooks/usePushNotifications';

async function handleAuthDeepLink(url: string) {
  const parsed = Linking.parse(url);

  // PKCE flow — ?code=xxx
  const code = parsed.queryParams?.code as string | undefined;
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  // Implicit flow fallback — #access_token=xxx&refresh_token=xxx
  const hash = url.split('#')[1];
  if (hash) {
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }
}

// Keep the splash visible while we fetch resources.
SplashScreen.preventAutoHideAsync();

// A single QueryClient instance for the lifetime of the app.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// ---------------------------------------------------------------------------
// Auth gate — redirects unauthenticated users to onboarding.
// ---------------------------------------------------------------------------

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, setSession } = useAuthStore();
  usePushNotifications();

  useEffect(() => {
    // Subscribe to auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // Hydrate session on mount.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
    });

    // Handle magic link when app is already open.
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('auth/callback') || url.includes('access_token') || url.includes('code=')) {
        handleAuthDeepLink(url);
      }
    });

    // Handle magic link when app is cold-started from the link.
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('auth/callback') || url.includes('access_token') || url.includes('code='))) {
        handleAuthDeepLink(url);
      }
    });

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, [setSession]);

  useEffect(() => {
    const inOnboarding = segments[0] === 'onboarding';
    const { preview } = useAuthStore.getState();

    if (session === undefined) return;
    if (preview) return; // preview mode bypasses auth gate

    if (!session && !inOnboarding) {
      router.replace('/onboarding');
    } else if (session && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, segments, router]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
