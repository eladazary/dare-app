import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Animated, Share } from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  placeName: string;
  difficulty: string;
  selfieUri: string | null;
  timeSeconds: number;
  xpMultiplier?: number;
  onTaunt: () => void;
  onContinue: () => void;
}

function formatTime(secs: number) {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

const MULTIPLIER_CONFIG: Record<number, { label: string; color: string; size: number }> = {
  1: { label: '1× XP', color: COLORS.concrete, size: 22 },
  2: { label: '2× XP BONUS!', color: COLORS.amber, size: 26 },
  3: { label: '3× MEGA BONUS!', color: COLORS.amber, size: 30 },
  5: { label: '5× LEGENDARY!', color: COLORS.classified, size: 34 },
};

export default function SolveReveal({ placeName, difficulty, selfieUri, timeSeconds, xpMultiplier = 1, onTaunt, onContinue }: Props) {
  const bg        = useRef(new Animated.Value(0)).current;
  const cardOp    = useRef(new Animated.Value(0)).current;
  const cardSc    = useRef(new Animated.Value(0.85)).current;
  const stampOp   = useRef(new Animated.Value(0)).current;
  const stampSc   = useRef(new Animated.Value(1.4)).current;
  const detailOp  = useRef(new Animated.Value(0)).current;
  const actionsOp = useRef(new Animated.Value(0)).current;
  // Multiplier reveal
  const multOp    = useRef(new Animated.Value(0)).current;
  const multSc    = useRef(new Animated.Value(0.5)).current;
  const multConfig = MULTIPLIER_CONFIG[xpMultiplier] ?? MULTIPLIER_CONFIG[1];

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bg, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(cardOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(cardSc, { toValue: 1, bounciness: 6, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(stampOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(stampSc, { toValue: 1, bounciness: 10, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(detailOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(multOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(multSc, { toValue: 1, bounciness: 12, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.timing(actionsOp, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: bg }]} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.card, { opacity: cardOp, transform: [{ scale: cardSc }] }]}>
          <View style={styles.photoArea}>
            {selfieUri && selfieUri !== 'dev-placeholder' ? (
              <Image source={{ uri: selfieUri }} style={styles.selfie} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📍</Text>
              </View>
            )}
          </View>

          <Animated.View style={[styles.stamp, { opacity: stampOp, transform: [{ scale: stampSc }, { rotate: '-8deg' }] }]}>
            <Text style={styles.stampText}>SOLVED</Text>
          </Animated.View>

          {/* XP multiplier reveal */}
          <Animated.View style={[styles.multiplierRow, { opacity: multOp, transform: [{ scale: multSc }] }]}>
            <Text style={[styles.multiplierText, { color: multConfig.color, fontSize: multConfig.size }]}>
              {multConfig.label}
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: detailOp }}>
            <Text style={styles.placeName}>{placeName}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaDiff}>{difficulty.toUpperCase()}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaTime}>{formatTime(timeSeconds)}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: actionsOp }]}>
          <TouchableOpacity style={styles.tauntBtn} onPress={onTaunt}>
            <Text style={styles.tauntBtnText}>⚔ Taunt a friend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Share.share({
              message: `I just cracked "${placeName}" in ${formatTime(timeSeconds)} on Tracer.\n\nThe world leaves traces. Find yours.\nruntracer.app`,
              title: 'Tracer',
            })}
          >
            <Text style={styles.shareBtnText}>↗ Share solve</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onContinue}>
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 200 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.92)' },
  scrollContent: {
    flexGrow: 1, alignItems: 'center',
    justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20,
  },
  card: {
    width: 280, backgroundColor: COLORS.cream,
    padding: 16, paddingBottom: 28, borderRadius: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.7, shadowRadius: 32, elevation: 24,
  },
  photoArea: {
    width: '100%', aspectRatio: 1,
    backgroundColor: COLORS.navyLight, borderRadius: 2,
    overflow: 'hidden', marginBottom: 14,
  },
  selfie: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoIcon: { fontSize: 48 },
  multiplierRow: {
    alignItems: 'center', paddingVertical: 8, marginBottom: 4,
  },
  multiplierText: {
    fontFamily: FONTS.uiExtraBold, textAlign: 'center', letterSpacing: 0.5,
  },
  stamp: {
    position: 'absolute', top: 24, right: 12,
    borderWidth: 2.5, borderColor: COLORS.green,
    borderRadius: 2, paddingHorizontal: 8, paddingVertical: 4,
  },
  stampText: {
    fontFamily: FONTS.monoBold, fontSize: 11,
    color: COLORS.green, letterSpacing: 3,
  },
  placeName: {
    fontFamily: FONTS.challenge, fontSize: 18,
    color: COLORS.redaction, lineHeight: 24,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaDiff: { fontFamily: FONTS.monoBold, fontSize: 9, color: COLORS.amber, letterSpacing: 1.5 },
  metaDot: { color: COLORS.concrete, fontSize: 10 },
  metaTime: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.redaction, opacity: 0.6, letterSpacing: 1 },
  actions: { marginTop: 40, alignItems: 'center', gap: 16 },
  tauntBtn: {
    backgroundColor: COLORS.classified,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 4,
  },
  tauntBtnText: { fontFamily: FONTS.monoBold, fontSize: 13, color: COLORS.ghost, letterSpacing: 1.5 },
  shareBtn: {
    borderWidth: 1, borderColor: COLORS.concrete,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 4,
  },
  shareBtnText: { fontFamily: FONTS.monoBold, fontSize: 13, color: COLORS.concrete, letterSpacing: 1.5 },
  continueText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete, letterSpacing: 2 },
});
