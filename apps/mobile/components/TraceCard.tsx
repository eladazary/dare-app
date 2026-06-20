import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

export function formatDistance(meters: number): string {
  if (meters < 300) return `${Math.round(meters)}m`;
  if (meters < 600) return '~400m';
  if (meters < 900) return '~600m';
  if (meters < 1200) return '~1km';
  if (meters < 1750) return '~1.5km';
  if (meters < 2500) return '~2km';
  return '2km+';
}

// Legacy compat — strips old [R:...] markup
export function parseClue(raw: string): string {
  return raw.replace(/\[R:[^\]]*\](.*?)\[\/R\]/gs, '$1').trim();
}

export type TraceStage = 'locked' | 'approaching' | 'close' | 'solved';
export type ClueSegment = { type: 'text'; content: string };

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: COLORS.green, medium: COLORS.amber,
  hard: COLORS.classified, legendary: COLORS.purple,
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD', legendary: 'LEGENDARY',
};

interface TraceCardProps {
  id: string;
  referencePhotoUrl?: string | null;
  clue?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  attemptsLeft: number;
  maxAttempts: number;
  stage: TraceStage;
  distanceMeters?: number;
  notifyRadiusMeters?: number;
  expiresAt?: string | null;
  xpMultiplier?: number;
  onSubmit?: () => void;
  // legacy compat
  segments?: ClueSegment[];
}

export default function TraceCard({
  id, referencePhotoUrl, clue, difficulty, attemptsLeft, maxAttempts,
  stage, distanceMeters, notifyRadiusMeters, expiresAt, xpMultiplier = 1, onSubmit,
}: TraceCardProps) {
  const isSolved  = stage === 'solved';
  const canSubmit = stage === 'close' || stage === 'solved';
  const col       = DIFFICULTY_COLOR[difficulty] ?? COLORS.amber;
  const [imgLoading, setImgLoading] = React.useState(true);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.diffDot, { backgroundColor: col }]} />
          <Text style={[styles.diffLabel, { color: col }]}>
            {DIFFICULTY_LABEL[difficulty]}
          </Text>
          {xpMultiplier > 1 && (
            <Text style={styles.multBadge}>{xpMultiplier}× XP</Text>
          )}
        </View>
        {distanceMeters != null && !isSolved && (() => {
          const distToEdge = notifyRadiusMeters
            ? Math.max(0, Math.round(distanceMeters - notifyRadiusMeters))
            : 0;
          const insideZone = distToEdge === 0;
          return (
            <View style={[styles.rangeBadge, insideZone && styles.rangeBadgeIn]}>
              <Text style={[styles.rangeText, insideZone && styles.rangeTextIn]}>
                {canSubmit
                  ? '✓ Found it'
                  : insideZone
                  ? 'Search the zone'
                  : `${distToEdge < 1000 ? `${distToEdge}m` : `${(distToEdge/1000).toFixed(1)}km`} to zone`}
              </Text>
            </View>
          );
        })()}
      </View>

      {/* Reference photo */}
      <View style={styles.photoContainer}>
        {referencePhotoUrl ? (
          <>
            {imgLoading && (
              <View style={styles.photoLoading}>
                <ActivityIndicator color={COLORS.amber} />
              </View>
            )}
            <Image
              source={{ uri: referencePhotoUrl }}
              style={[styles.photo, imgLoading && { opacity: 0 }]}
              resizeMode="cover"
              onLoadEnd={() => setImgLoading(false)}
            />
            {!isSolved && (
              <View style={styles.photoOverlay}>
                <Text style={styles.photoInstruction}>Find this exact spot</Text>
              </View>
            )}
            {isSolved && (
              <View style={[styles.photoOverlay, styles.photoOverlaySolved]}>
                <Text style={styles.solvedBadgeText}>✓ FOUND</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>Photo loading...</Text>
          </View>
        )}
      </View>

      {/* Context clue (shown after solving) */}
      {clue && isSolved && (
        <View style={styles.captionBox}>
          <Text style={styles.captionLabel}>ABOUT THIS PLACE</Text>
          <Text style={styles.captionText}>{clue}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.attemptsRow}>
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <View key={i} style={[
              styles.attemptDot,
              { backgroundColor: i < attemptsLeft ? col : COLORS.navyLight },
            ]} />
          ))}
          <Text style={styles.attemptsLabel}>
            {isSolved ? 'FOUND' : `${attemptsLeft} attempts left`}
          </Text>
        </View>

        {!isSolved && (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canSubmit ? col : COLORS.navyLight }]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            <Text style={[styles.submitBtnText, { color: canSubmit ? COLORS.navy : COLORS.concrete }]}>
              {canSubmit ? 'I found it →' : 'Get closer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!isSolved && stage === 'locked' && (
        <Text style={styles.walkHint}>Walk closer to unlock</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyMid, borderRadius: 16,
    marginHorizontal: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffLabel: { fontFamily: FONTS.monoBold, fontSize: 11, letterSpacing: 2 },
  multBadge: {
    fontFamily: FONTS.monoBold, fontSize: 9, color: COLORS.navy,
    backgroundColor: COLORS.amber, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, letterSpacing: 0.5,
  },
  distText: {
    fontFamily: FONTS.monoBold, fontSize: 12,
    color: COLORS.concrete, letterSpacing: 0.5,
  },
  distTextClose: { color: COLORS.green },
  rangeBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: 'rgba(138,138,138,0.15)',
    borderWidth: 1, borderColor: 'rgba(138,138,138,0.3)',
  },
  rangeBadgeIn: {
    backgroundColor: 'rgba(0,230,118,0.15)',
    borderColor: COLORS.green,
  },
  rangeText: { fontFamily: FONTS.monoBold, fontSize: 10, color: COLORS.concrete, letterSpacing: 0.5 },
  rangeTextIn: { color: COLORS.green },
  photoContainer: {
    width: '100%', aspectRatio: 1,
    backgroundColor: COLORS.navy, position: 'relative',
  },
  photo: { width: '100%', height: '100%' },
  photoLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
  },
  photoOverlaySolved: { backgroundColor: 'rgba(0,230,118,0.25)' },
  photoInstruction: {
    fontFamily: FONTS.monoBold, fontSize: 12,
    color: COLORS.ghost, letterSpacing: 1.5,
  },
  solvedBadgeText: {
    fontFamily: FONTS.monoBold, fontSize: 14,
    color: COLORS.green, letterSpacing: 3,
  },
  photoPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderText: {
    fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete,
  },
  photoLocked: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.navyLight,
  },
  photoLockedIcon: {
    fontSize: 44, color: COLORS.concrete, opacity: 0.4,
  },
  photoLockedTitle: {
    fontFamily: FONTS.monoBold, fontSize: 11, color: COLORS.concrete,
    letterSpacing: 4,
  },
  photoLockedSub: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete,
    opacity: 0.6, textAlign: 'center', paddingHorizontal: 24,
  },
  captionBox: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.navyLight, borderRadius: 8, padding: 12,
    borderLeftWidth: 3, borderLeftColor: COLORS.amber,
  },
  captionLabel: {
    fontFamily: FONTS.monoBold, fontSize: 8, color: COLORS.amber,
    letterSpacing: 2, marginBottom: 4,
  },
  captionText: {
    fontFamily: FONTS.ui, fontSize: 13, color: COLORS.ghost, lineHeight: 20,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  attemptsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attemptDot: { width: 8, height: 8, borderRadius: 4 },
  attemptsLabel: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete,
    letterSpacing: 0.5, marginLeft: 4,
  },
  submitBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  submitBtnText: { fontFamily: FONTS.uiBold, fontSize: 13 },
  walkHint: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete,
    textAlign: 'center', paddingBottom: 12, opacity: 0.5, letterSpacing: 1,
  },
});
