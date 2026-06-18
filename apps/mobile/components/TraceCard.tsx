import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

// Below 300m: exact. Above: bucketed.
export function formatDistance(meters: number): string {
  if (meters < 300) return `${Math.round(meters)}m`;
  if (meters < 600) return '~400m';
  if (meters < 900) return '~600m';
  if (meters < 1200) return '~1km';
  if (meters < 1750) return '~1.5km';
  if (meters < 2500) return '~2km';
  return '2km+';
}

// Legacy: parse clue string into plain text (strips [R:...] markup)
export function parseClue(raw: string): string {
  return raw.replace(/\[R:[^\]]*\](.*?)\[\/R\]/gs, '$1').trim();
}

// Keep for type compat in map.tsx
export type TraceStage = 'locked' | 'approaching' | 'close' | 'solved';
export type ClueSegment = { type: 'text'; content: string };

function useCountdown(expiresAt?: string | null) {
  const [secsLeft, setSecsLeft] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!expiresAt) return;
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSecsLeft(calc());
    const id = setInterval(() => setSecsLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return secsLeft;
}

function formatCountdown(secs: number): string {
  if (secs < 60) return '< 1m';
  if (secs < 3600) { const m = Math.floor(secs / 60), s = secs % 60; return `${m}m ${s}s`; }
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: COLORS.green, medium: COLORS.amber,
  hard: COLORS.classified, legendary: COLORS.purple,
};

interface TraceCardProps {
  id: string;
  clue: string;                 // plain string — no markup
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  attemptsLeft: number;
  maxAttempts: number;
  stage: TraceStage;
  distanceMeters?: number;
  expiresAt?: string | null;
  xpMultiplier?: number;
  onSubmit?: () => void;
  // Legacy compat
  segments?: ClueSegment[];
}

export default function TraceCard({
  id, clue, difficulty, attemptsLeft, maxAttempts,
  stage, distanceMeters, expiresAt, xpMultiplier = 1, onSubmit,
}: TraceCardProps) {
  const isSolved = stage === 'solved';
  const canSubmit = stage === 'close' || stage === 'solved';
  const secsLeft = useCountdown(expiresAt);
  const isUrgent = secsLeft !== null && secsLeft < 1800;

  return (
    <View style={styles.card}>
      {!isSolved && (
        <View style={styles.stamp} pointerEvents="none">
          <Text style={styles.stampText}>CLASSIFIED</Text>
        </View>
      )}

      {/* Distance badge */}
      {distanceMeters != null && !isSolved && (
        <View style={[styles.distanceBadge, stage === 'close' && styles.distanceBadgeClose]}>
          <Text style={[styles.distanceBadgeText, stage === 'close' && styles.distanceBadgeTextClose]}>
            📍 {formatDistance(distanceMeters)} away
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.traceId}>TRACE #{id.slice(-4).toUpperCase()}</Text>
      </View>

      {/* Difficulty + TTL + multiplier */}
      <View style={styles.difficultyRow}>
        <View style={[styles.difficultyDot, { backgroundColor: DIFFICULTY_COLOR[difficulty] }]} />
        <Text style={[styles.difficultyText, { color: DIFFICULTY_COLOR[difficulty] }]}>
          {difficulty.toUpperCase()}
        </Text>
        {secsLeft !== null && secsLeft > 0 && (
          <Text style={[styles.ttlBadge, isUrgent && styles.ttlUrgent]}>
            ⏱ {formatCountdown(secsLeft)}
          </Text>
        )}
        {xpMultiplier > 1 && (
          <Text style={styles.multiplierBadge}>{xpMultiplier}× XP</Text>
        )}
      </View>

      <View style={styles.divider} />

      {/* Clue — full text, no hiding */}
      <Text style={styles.clueText}>{clue}</Text>

      <View style={styles.divider} />

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.attemptsRow}>
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <View key={i} style={[
              styles.attemptDot,
              { backgroundColor: i < attemptsLeft ? COLORS.redaction : COLORS.creamDim },
            ]} />
          ))}
          <Text style={styles.attemptsLabel}>
            {isSolved ? 'SOLVED' : `${attemptsLeft} LEFT`}
          </Text>
        </View>

        {!isSolved && (
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>
              {canSubmit ? 'SUBMIT PROOF →' : 'GET CLOSER'}
            </Text>
          </TouchableOpacity>
        )}

        {isSolved && (
          <View style={styles.solvedBadge}>
            <Text style={styles.solvedText}>✓ CONFIRMED</Text>
          </View>
        )}
      </View>

      {/* Walk closer hint when not in range */}
      {!isSolved && stage === 'locked' && (
        <Text style={styles.revealHint}>🚶 Walk closer to submit proof</Text>
      )}

      <Text style={styles.locationClassified}>LOCATION CLASSIFIED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cream, borderRadius: 4, padding: 20,
    marginHorizontal: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  stamp: {
    position: 'absolute', top: 18, right: 16,
    borderWidth: 2, borderColor: COLORS.classified, borderRadius: 2,
    paddingHorizontal: 6, paddingVertical: 2,
    transform: [{ rotate: '-12deg' }], zIndex: 10,
  },
  stampText: {
    fontFamily: FONTS.monoBold, fontSize: 9,
    color: COLORS.classified, letterSpacing: 2, opacity: 0.85,
  },
  distanceBadge: {
    backgroundColor: COLORS.redaction, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  distanceBadgeClose: { backgroundColor: COLORS.green },
  distanceBadgeText: {
    fontFamily: FONTS.monoBold, fontSize: 12, color: COLORS.cream, letterSpacing: 0.5,
  },
  distanceBadgeTextClose: { color: COLORS.navy },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  traceId: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.redaction,
    letterSpacing: 2, opacity: 0.5,
  },
  difficultyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14,
  },
  difficultyDot: { width: 6, height: 6, borderRadius: 3 },
  difficultyText: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.5 },
  ttlBadge: { fontFamily: FONTS.monoBold, fontSize: 9, color: COLORS.amber, letterSpacing: 1, marginLeft: 6 },
  ttlUrgent: { color: COLORS.classified },
  multiplierBadge: {
    fontFamily: FONTS.monoBold, fontSize: 9, color: COLORS.navy,
    backgroundColor: COLORS.amber, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 3, marginLeft: 6, letterSpacing: 0.5,
  },
  divider: { height: 1, backgroundColor: COLORS.creamDim, marginVertical: 14 },
  clueText: {
    fontFamily: FONTS.challengeItalic, fontSize: 16,
    color: COLORS.redaction, lineHeight: 26,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  attemptsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attemptDot: { width: 8, height: 8, borderRadius: 4 },
  attemptsLabel: {
    fontFamily: FONTS.mono, fontSize: 9, color: COLORS.redaction,
    letterSpacing: 1.5, opacity: 0.5, marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: COLORS.redaction, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2,
  },
  submitBtnDisabled: { backgroundColor: COLORS.creamDim },
  submitBtnText: { fontFamily: FONTS.monoBold, fontSize: 10, color: COLORS.cream, letterSpacing: 1.5 },
  solvedBadge: { borderWidth: 1, borderColor: COLORS.green, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2 },
  solvedText: { fontFamily: FONTS.monoBold, fontSize: 10, color: COLORS.green, letterSpacing: 2 },
  revealHint: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.redaction,
    opacity: 0.4, textAlign: 'center', marginTop: 8, letterSpacing: 0.5,
  },
  locationClassified: {
    fontFamily: FONTS.mono, fontSize: 9, color: COLORS.redaction,
    letterSpacing: 3, opacity: 0.25, textAlign: 'center', marginTop: 12,
  },
});
