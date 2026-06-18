import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { useAuthStore } from '@/store/auth';

// This screen is the landing point after the user taps the magic link.
// The actual session exchange happens in _layout.tsx via the Linking listener.
// We just show a spinner and wait for the session to be set.
export default function AuthCallback() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/map');
    }
  }, [session, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={COLORS.amber} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
