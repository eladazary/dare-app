import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { formatDistance } from '@/components/TraceCard';

interface Props {
  visible: boolean;
  placeName: string;        // the real answer — never shown
  distanceMeters: number;
  solveRadiusMeters: number;
  onCorrect: () => void;    // answer is right → open camera
  onWrong: () => void;      // answer is wrong → lose attempt
  onClose: () => void;
}

// Fuzzy match — answer must meaningfully overlap with place name
function isCorrectAnswer(answer: string, placeName: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[֑-ׇ]/g, '') // strip Hebrew vowel marks
      .replace(/['".,!?-]/g, '')
      .trim();

  const a = normalize(answer);
  const p = normalize(placeName);

  if (!a || a.length < 2) return false;

  // Direct contains check
  if (p.includes(a) || a.includes(p)) return true;

  // Word-level match — any significant word in the answer matches a word in the place name
  const answerWords = a.split(/\s+/).filter(w => w.length >= 3);
  const placeWords  = p.split(/\s+/).filter(w => w.length >= 3);

  return answerWords.some(aw => placeWords.some(pw =>
    pw.includes(aw) || aw.includes(pw)
  ));
}

export default function AnswerModal({
  visible, placeName, distanceMeters, solveRadiusMeters, onCorrect, onWrong, onClose,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [shake, setShake] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = () => {
    if (!answer.trim()) return;
    if (isCorrectAnswer(answer, placeName)) {
      setAnswer('');
      onCorrect();
    } else {
      triggerShake();
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setAnswer('');
      onWrong();
    }
  };

  const withinRadius = distanceMeters <= solveRadiusMeters;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.label}>IDENTIFY THE LOCATION</Text>
          <Text style={styles.sub}>
            You're {formatDistance(distanceMeters)} away.{'\n'}
            Name the exact place to submit proof.
          </Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }], width: '100%' }}>
            <TextInput
              style={[styles.input, shake && styles.inputError]}
              placeholder="Type what this place is..."
              placeholderTextColor={COLORS.concrete}
              value={answer}
              onChangeText={setAnswer}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </Animated.View>

          {shake && (
            <Text style={styles.wrongText}>✗ Wrong — try again or move closer</Text>
          )}

          <TouchableOpacity
            style={[styles.btn, !answer.trim() && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!answer.trim()}
          >
            <Text style={styles.btnText}>Confirm answer →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyMid,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, alignItems: 'center', gap: 12,
  },
  label: {
    fontFamily: FONTS.monoBold, fontSize: 10,
    color: COLORS.amber, letterSpacing: 3,
  },
  sub: {
    fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete,
    textAlign: 'center', lineHeight: 20,
  },
  input: {
    backgroundColor: COLORS.navyLight, borderRadius: 10,
    paddingHorizontal: 16, height: 52, color: COLORS.ghost,
    fontFamily: FONTS.uiBold, fontSize: 16,
    borderWidth: 1, borderColor: COLORS.navyLight, width: '100%',
    textAlign: 'center',
  },
  inputError: { borderColor: COLORS.classified },
  wrongText: {
    fontFamily: FONTS.mono, fontSize: 11,
    color: COLORS.classified, letterSpacing: 0.5,
  },
  btn: {
    backgroundColor: COLORS.amber, borderRadius: 50,
    paddingVertical: 14, alignItems: 'center', width: '100%',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.navy },
  cancelText: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete,
    letterSpacing: 1, marginTop: 4,
  },
});
