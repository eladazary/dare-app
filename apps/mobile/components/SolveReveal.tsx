import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  placeName: string;
  difficulty: string;
  selfieUri: string | null;
  timeSeconds: number;
  onTaunt: () => void;
  onContinue: () => void;
}

function formatTime(secs: number) {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function SolveReveal({ placeName, difficulty, selfieUri, timeSeconds, onTaunt, onContinue }: Props) {
  const bg = useSharedValue(0);
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const stampOpacity = useSharedValue(0);
  const stampScale = useSharedValue(1.4);
  const detailOpacity = useSharedValue(0);
  const actionsOpacity = useSharedValue(0);

  useEffect(() => {
    bg.value = withTiming(1, { duration: 400 });
    cardOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    cardScale.value = withDelay(200, withSpring(1, { damping: 16, stiffness: 140 }));
    stampOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));
    stampScale.value = withDelay(700, withSpring(1, { damping: 12, stiffness: 200 }));
    detailOpacity.value = withDelay(1100, withTiming(1, { duration: 400 }));
    actionsOpacity.value = withDelay(1700, withTiming(1, { duration: 400 }));
  }, []);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampOpacity.value,
    transform: [{ scale: stampScale.value }, { rotate: '-8deg' }],
  }));
  const detailStyle = useAnimatedStyle(() => ({ opacity: detailOpacity.value }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: actionsOpacity.value }));

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, bgStyle]} />

      {/* Polaroid card */}
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Selfie area */}
        <View style={styles.photoArea}>
          {selfieUri ? (
            <Image source={{ uri: selfieUri }} style={styles.selfie} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📍</Text>
            </View>
          )}
        </View>

        {/* SOLVED stamp */}
        <Animated.View style={[styles.stamp, stampStyle]}>
          <Text style={styles.stampText}>SOLVED</Text>
        </Animated.View>

        {/* Place name + details */}
        <Animated.View style={[styles.cardBody, detailStyle]}>
          <Text style={styles.placeName}>{placeName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaDiff}>{difficulty.toUpperCase()}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaTime}>{formatTime(timeSeconds)}</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Actions */}
      <Animated.View style={[styles.actions, actionsStyle]}>
        <TouchableOpacity style={styles.tauntBtn} onPress={onTaunt}>
          <Text style={styles.tauntBtnText}>⚔ Taunt a friend</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onContinue}>
          <Text style={styles.continueText}>Continue →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  card: {
    width: 280,
    backgroundColor: COLORS.cream,
    padding: 16,
    paddingBottom: 28,
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.7,
    shadowRadius: 32,
    elevation: 24,
    transform: [{ rotate: '-1.5deg' }],
  },
  photoArea: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.navyLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  selfie: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: {
    fontSize: 48,
  },
  stamp: {
    position: 'absolute',
    top: 24,
    right: 12,
    borderWidth: 2.5,
    borderColor: COLORS.green,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stampText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: COLORS.green,
    letterSpacing: 3,
  },
  cardBody: {
    gap: 4,
  },
  placeName: {
    fontFamily: FONTS.challenge,
    fontSize: 18,
    color: COLORS.redaction,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaDiff: {
    fontFamily: FONTS.monoBold,
    fontSize: 9,
    color: COLORS.amber,
    letterSpacing: 1.5,
  },
  metaDot: {
    color: COLORS.concrete,
    fontSize: 10,
  },
  metaTime: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.redaction,
    opacity: 0.6,
    letterSpacing: 1,
  },
  actions: {
    marginTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  tauntBtn: {
    backgroundColor: COLORS.classified,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 4,
  },
  tauntBtnText: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: COLORS.ghost,
    letterSpacing: 1.5,
  },
  continueText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.concrete,
    letterSpacing: 2,
  },
});
