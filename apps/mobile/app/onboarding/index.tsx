import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

export default function OnboardingIndex() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuestSignIn = async () => {
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (err) setError(err.message);
    // _layout.tsx auth gate detects the new session and navigates to /(tabs)
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TRACER</Text>
      <Text style={styles.subtitle}>The world leaves traces. Find yours.</Text>
      <Text style={styles.emoji}>🌍</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleGuestSignIn}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={COLORS.navy} />
          : <Text style={styles.buttonText}>Start tracing →</Text>
        }
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.legalText}>
        By continuing you accept our Terms & Privacy Policy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: COLORS.ghost,
    fontSize: 48,
    fontFamily: FONTS.uiExtraBold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.concrete,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: 96,
    marginBottom: 56,
  },
  button: {
    backgroundColor: COLORS.amber,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: COLORS.navy,
    fontFamily: FONTS.uiBold,
    fontSize: 16,
  },
  errorText: {
    color: COLORS.classified,
    fontFamily: FONTS.mono,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  legalText: {
    color: COLORS.concrete,
    fontFamily: FONTS.mono,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.5,
    letterSpacing: 0.3,
  },
});
