import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Animated, Share } from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  placeName: string;
  difficulty: string;
  referencePhotoUrl: string | null;
  selfieUri: string | null;
  timeSeconds: number;
  caption?: string | null;   // revealed after solving
  xpMultiplier?: number;
  onTaunt: () => void;
  onContinue: () => void;
}

function formatTime(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const DIFF_COLOR: Record<string, string> = {
  easy: COLORS.green, medium: COLORS.amber,
  hard: COLORS.classified, legendary: COLORS.purple,
};

const MULT_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: '1× XP', color: COLORS.concrete },
  2: { label: '2× XP BONUS!', color: COLORS.amber },
  3: { label: '3× MEGA BONUS!', color: COLORS.amber },
  5: { label: '5× LEGENDARY!', color: COLORS.classified },
};

export default function SolveReveal({
  placeName, difficulty, referencePhotoUrl, selfieUri,
  timeSeconds, caption, xpMultiplier = 1, onTaunt, onContinue,
}: Props) {
  const bg      = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const mult    = useRef(new Animated.Value(0)).current;
  const multSc  = useRef(new Animated.Value(0.6)).current;
  const actions = useRef(new Animated.Value(0)).current;

  const mc = MULT_CONFIG[xpMultiplier] ?? MULT_CONFIG[1];
  const dc = DIFF_COLOR[difficulty] ?? COLORS.amber;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bg,      { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(content, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(mult,   { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(multSc, { toValue: 1, bounciness: 10, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.timing(actions, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: bg }]} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <Animated.View style={{ opacity: content }}>
          <Text style={styles.foundLabel}>TRACE FOUND</Text>
          <Text style={styles.placeName}>{placeName}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.diff, { color: dc }]}>{difficulty.toUpperCase()}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.time}>{formatTime(timeSeconds)}</Text>
          </View>
        </Animated.View>

        {/* Side by side comparison */}
        <Animated.View style={[styles.comparison, { opacity: content }]}>
          <View style={styles.photoCol}>
            <Text style={styles.photoColLabel}>TRACE</Text>
            {referencePhotoUrl ? (
              <Image source={{ uri: referencePhotoUrl }} style={styles.compPhoto} resizeMode="cover" />
            ) : (
              <View style={[styles.compPhoto, styles.compPhotoPlaceholder]}>
                <Text style={{ color: COLORS.concrete }}>No photo</Text>
              </View>
            )}
          </View>
          <View style={styles.vsCol}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.photoCol}>
            <Text style={styles.photoColLabel}>YOUR SHOT</Text>
            {selfieUri && selfieUri !== 'dev-placeholder' ? (
              <Image source={{ uri: selfieUri }} style={styles.compPhoto} resizeMode="cover" />
            ) : (
              <View style={[styles.compPhoto, styles.compPhotoPlaceholder]}>
                <Text style={{ fontSize: 32 }}>📷</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* XP multiplier */}
        <Animated.View style={[styles.multRow, { opacity: mult, transform: [{ scale: multSc }] }]}>
          <Text style={[styles.multText, { color: mc.color }]}>{mc.label}</Text>
        </Animated.View>

        {/* Caption revealed after solving */}
        {caption && (
          <Animated.View style={[styles.captionBox, { opacity: actions }]}>
            <Text style={styles.captionLabel}>DID YOU KNOW</Text>
            <Text style={styles.captionText}>{caption}</Text>
          </Animated.View>
        )}

        {/* Actions */}
        <Animated.View style={[styles.actions, { opacity: actions }]}>
          <TouchableOpacity style={styles.tauntBtn} onPress={onTaunt}>
            <Text style={styles.tauntBtnText}>⚔ Challenge a friend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Share.share({
              message: `I just found "${placeName}" on Tracer — ${formatTime(timeSeconds)}.\n\nThe world leaves traces. Find yours.\nruntracer.app`,
            })}
          >
            <Text style={styles.shareBtnText}>↗ Share find</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onContinue}>
            <Text style={styles.continueText}>Continue exploring →</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 200 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.94)' },
  scroll: {
    flexGrow: 1, alignItems: 'center',
    paddingVertical: 60, paddingHorizontal: 24, gap: 20,
  },
  foundLabel: {
    fontFamily: FONTS.monoBold, fontSize: 10, color: COLORS.green,
    letterSpacing: 4, textAlign: 'center', marginBottom: 8,
  },
  placeName: {
    fontFamily: FONTS.uiExtraBold, fontSize: 24, color: COLORS.ghost,
    textAlign: 'center', lineHeight: 30,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 6,
  },
  diff: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 2 },
  metaDot: { color: COLORS.concrete, fontSize: 12 },
  time: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete },
  comparison: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
  },
  photoCol: { flex: 1, gap: 6 },
  photoColLabel: {
    fontFamily: FONTS.monoBold, fontSize: 8, color: COLORS.concrete,
    letterSpacing: 2, textAlign: 'center',
  },
  compPhoto: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  compPhotoPlaceholder: {
    backgroundColor: COLORS.navyMid, alignItems: 'center', justifyContent: 'center',
  },
  vsCol: { alignItems: 'center', width: 28 },
  vsText: {
    fontFamily: FONTS.uiExtraBold, fontSize: 12, color: COLORS.concrete,
  },
  multRow: { alignItems: 'center' },
  multText: {
    fontFamily: FONTS.uiExtraBold, fontSize: 24, textAlign: 'center',
  },
  captionBox: {
    backgroundColor: COLORS.navyMid, borderRadius: 10, padding: 16, width: '100%',
    borderLeftWidth: 3, borderLeftColor: COLORS.amber, gap: 6,
  },
  captionLabel: {
    fontFamily: FONTS.monoBold, fontSize: 8, color: COLORS.amber, letterSpacing: 2,
  },
  captionText: {
    fontFamily: FONTS.ui, fontSize: 14, color: COLORS.ghost, lineHeight: 22,
  },
  actions: { alignItems: 'center', gap: 12, width: '100%' },
  tauntBtn: {
    backgroundColor: COLORS.classified, borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', width: '100%',
  },
  tauntBtnText: { fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.ghost },
  shareBtn: {
    borderWidth: 1, borderColor: COLORS.concrete, borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', width: '100%',
  },
  shareBtnText: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.concrete },
  continueText: {
    fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete, letterSpacing: 1,
  },
});
