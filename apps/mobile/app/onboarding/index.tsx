import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

export default function OnboardingIndex() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSendMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (!error) setSent(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DARE</Text>
      <Text style={styles.subtitle}>The city dares you. Every day.</Text>
      <Text style={styles.emoji}>🏙️</Text>

      {sent ? (
        <Text style={styles.successText}>Check your messages. Your access link is waiting. ✓</Text>
      ) : (
        <>
          <TextInput
            style={[styles.input, { borderColor: focused ? COLORS.amber : COLORS.navyLight }]}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.concrete}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleSendMagicLink}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.navy} />
            ) : (
              <Text style={styles.buttonText}>Send access link</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity>
        <Text style={styles.signInText}>Already an agent? Sign in</Text>
      </TouchableOpacity>
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
    fontFamily: 'SpaceGrotesk_700Bold',
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
    marginBottom: 48,
  },
  input: {
    color: COLORS.ghost,
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
  },
  button: {
    backgroundColor: COLORS.amber,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: COLORS.navy,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  successText: {
    color: COLORS.green,
    fontSize: 15,
    textAlign: 'center',
  },
  signInText: {
    color: COLORS.concrete,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
});
