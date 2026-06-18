import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';

type Step = 'email' | 'otp';

export default function OnboardingIndex() {
  const router = useRouter();
  const setPreview = useAuthStore((s) => s.setPreview);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  // ── Step 1: send OTP ──
  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setStep('otp');
  };

  // ── Step 2: verify OTP ──
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    });
    setLoading(false);
    if (err) { setError('Invalid code — check your email and try again.'); return; }
    // _layout.tsx auth gate picks up the new session and redirects automatically
  };

  const handleOtpChange = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.slice(-1); // one char per box
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TRACER</Text>
      <Text style={styles.subtitle}>The world leaves traces. Find yours.</Text>
      <Text style={styles.emoji}>🌍</Text>

      {step === 'email' ? (
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
            onPress={handleSendOtp}
            disabled={loading || !email.trim()}
          >
            {loading
              ? <ActivityIndicator color={COLORS.navy} />
              : <Text style={styles.buttonText}>Send access code</Text>
            }
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.otpHint}>
            Enter the 6-digit code{'\n'}sent to {email}
          </Text>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => { otpRefs.current[i] = r; }}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                ]}
                value={digit}
                onChangeText={(v) => handleOtpChange(v, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                caretHidden
              />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, otp.join('').length < 6 && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otp.join('').length < 6}
          >
            {loading
              ? <ActivityIndicator color={COLORS.navy} />
              : <Text style={styles.buttonText}>Confirm →</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep('email'); setOtp(['','','','','','']); setError(''); }}>
            <Text style={styles.backText}>← Wrong email?</Text>
          </TouchableOpacity>
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity onPress={() => { setPreview(true); router.replace('/(tabs)/map'); }}>
        <Text style={styles.previewText}>Preview the app →</Text>
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
    fontFamily: FONTS.ui,
    fontSize: 15,
  },
  button: {
    backgroundColor: COLORS.amber,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: COLORS.navy,
    fontFamily: FONTS.uiBold,
    fontSize: 15,
  },
  otpHint: {
    color: COLORS.concrete,
    fontFamily: FONTS.mono,
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 28,
    lineHeight: 20,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.navyLight,
    backgroundColor: COLORS.navyMid,
    color: COLORS.ghost,
    fontSize: 24,
    fontFamily: FONTS.uiBold,
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: COLORS.amber,
  },
  backText: {
    color: COLORS.concrete,
    fontFamily: FONTS.mono,
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  errorText: {
    color: COLORS.classified,
    fontFamily: FONTS.mono,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  previewText: {
    color: COLORS.amber,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.5,
  },
});
