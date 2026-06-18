import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

export default function UsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);

  const handleSave = async () => {
    if (!isValid) return;
    setError('');
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error: err } = await supabase
      .from('users')
      .update({ username: username.toLowerCase() })
      .eq('auth_id', user.id);

    setLoading(false);
    if (err) {
      setError(err.message.includes('unique') ? 'That name is taken.' : err.message);
      return;
    }
    router.replace('/(tabs)/map');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>TRACER</Text>
        <Text style={styles.heading}>Choose your agent name.</Text>
        <Text style={styles.sub}>
          This is how other Tracers will see you.{'\n'}Letters, numbers and _ only.
        </Text>

        <View style={styles.inputRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            placeholder="agent_name"
            placeholderTextColor={COLORS.concrete}
            value={username}
            onChangeText={setUsername}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
        </View>

        {username.length > 0 && !isValid && (
          <Text style={styles.hint}>3–20 characters, letters/numbers/_ only</Text>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!isValid || loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.navy} />
            : <Text style={styles.btnText}>Start tracing →</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)/map')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  inner: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: COLORS.ghost, fontSize: 32, fontFamily: FONTS.uiExtraBold,
    letterSpacing: 4, marginBottom: 32,
  },
  heading: {
    color: COLORS.ghost, fontSize: 22, fontFamily: FONTS.uiExtraBold,
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    color: COLORS.concrete, fontSize: 13, fontFamily: FONTS.mono,
    textAlign: 'center', lineHeight: 20, marginBottom: 36,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', marginBottom: 8,
  },
  atSign: {
    color: COLORS.amber, fontFamily: FONTS.uiBold,
    fontSize: 22, marginRight: 6,
  },
  input: {
    flex: 1, backgroundColor: COLORS.navyMid, borderRadius: 10,
    paddingHorizontal: 16, height: 52, color: COLORS.ghost,
    fontFamily: FONTS.uiBold, fontSize: 18,
    borderWidth: 1, borderColor: COLORS.navyLight,
  },
  inputFocused: { borderColor: COLORS.amber },
  hint: {
    color: COLORS.concrete, fontFamily: FONTS.mono, fontSize: 11,
    marginBottom: 12, letterSpacing: 0.5,
  },
  errorText: {
    color: COLORS.classified, fontFamily: FONTS.mono,
    fontSize: 12, marginBottom: 12,
  },
  btn: {
    backgroundColor: COLORS.amber, borderRadius: 50,
    paddingVertical: 15, alignItems: 'center',
    width: '100%', marginTop: 8,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: COLORS.navy, fontFamily: FONTS.uiBold, fontSize: 15 },
  skipText: {
    color: COLORS.concrete, fontFamily: FONTS.mono,
    fontSize: 12, marginTop: 20, opacity: 0.6,
  },
});
