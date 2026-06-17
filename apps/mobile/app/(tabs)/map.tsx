import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import TraceCard, { parseClue, type TraceStage } from '@/components/TraceCard';
import TracePin from '@/components/TracePin';

// ─────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────

const MOCK_ACTIVE_TRACE = {
  id: 'a3f7c2e1',
  clue: [
    'I have stood at this corner since ',
    '[R:approaching]1887[/R]',
    ', watching every sunrise without ever moving. The ',
    '[R:close]oldest thing here[/R]',
    ' that is not a building. I have a name nobody uses anymore.',
  ].join(''),
  difficulty: 'hard' as const,
  attemptsLeft: 2,
  maxAttempts: 3,
  distanceMeters: 94,
};

const MOCK_NEARBY = [
  { id: 'b1d4e9f2', difficulty: 'easy' as const, distanceMeters: 180, label: 'The market entrance' },
  { id: 'c8a2f0e5', difficulty: 'medium' as const, distanceMeters: 340, label: 'Under the bridge' },
  { id: 'd5c1b7a3', difficulty: 'legendary' as const, distanceMeters: 820, label: '???' },
];

const MOCK_TERRITORY = {
  zoneName: 'Florentin',
  solveCount: 7,
  totalInZone: 12,
  rank: 1,
};

// ─────────────────────────────────────────────
// Difficulty colour helper
// ─────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
  easy: COLORS.green,
  medium: COLORS.amber,
  hard: COLORS.classified,
  legendary: COLORS.purple,
};

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export default function MapScreen() {
  const [activeTab, setActiveTab] = useState<'hunt' | 'territory'>('hunt');
  // Cycle through stages for demo
  const [stage, setStage] = useState<TraceStage>('approaching');

  const segments = parseClue(MOCK_ACTIVE_TRACE.clue);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>FIELD OPS</Text>
            <Text style={styles.headerTitle}>Hunt</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.streakLabel}>RUN</Text>
            <Text style={styles.streakCount}>14</Text>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          {(['hunt', 'territory'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={styles.tab}
              onPress={() => setActiveTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t === 'hunt' ? 'TRACE HUNT' : 'MY TERRITORY'}
              </Text>
              {activeTab === t && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ════════════════════════
            HUNT TAB
        ════════════════════════ */}
        {activeTab === 'hunt' && (
          <View>

            {/* ── Active trace ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ACTIVE TRACE</Text>
              <View style={styles.activeDot} />
            </View>

            <TraceCard
              id={MOCK_ACTIVE_TRACE.id}
              segments={segments}
              difficulty={MOCK_ACTIVE_TRACE.difficulty}
              attemptsLeft={MOCK_ACTIVE_TRACE.attemptsLeft}
              maxAttempts={MOCK_ACTIVE_TRACE.maxAttempts}
              stage={stage}
              distanceMeters={MOCK_ACTIVE_TRACE.distanceMeters}
              onSubmit={() => {}}
            />

            {/* Stage stepper — demo only */}
            <View style={styles.stageStepper}>
              {(['locked', 'approaching', 'close', 'solved'] as TraceStage[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stageBtn, stage === s && styles.stageBtnActive]}
                  onPress={() => setStage(s)}
                >
                  <Text style={[styles.stageBtnText, stage === s && styles.stageBtnTextActive]}>
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.stageHint}>↑ demo: tap to simulate proximity</Text>

            {/* ── Nearby pins visual ── */}
            <View style={styles.pinsRow}>
              <TracePin state="active" distanceMeters={94} />
              <TracePin state="undiscovered" distanceMeters={180} />
              <TracePin state="undiscovered" distanceMeters={340} />
              <TracePin state="ghost" distanceMeters={210} />
              <TracePin state="solved" />
            </View>
            <Text style={styles.pinsHint}>5 traces in range · 1 ghost trail nearby</Text>

            {/* ── Nearby list ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>NEARBY</Text>
            </View>

            {MOCK_NEARBY.map((c) => (
              <TouchableOpacity key={c.id} style={styles.nearbyCard} activeOpacity={0.8}>
                <View style={styles.nearbyLeft}>
                  <View style={[styles.nearbyDot, { backgroundColor: DIFF_COLOR[c.difficulty] }]} />
                  <View>
                    <Text style={styles.nearbyLabel}>
                      {c.difficulty === 'legendary' ? '???' : `TRACE #${c.id.slice(-4).toUpperCase()}`}
                    </Text>
                    <Text style={styles.nearbyDiff}>
                      {c.difficulty.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.nearbyRight}>
                  <Text style={[styles.nearbyDistance, { color: DIFF_COLOR[c.difficulty] }]}>
                    {c.distanceMeters}M
                  </Text>
                  <Text style={styles.nearbyArrow}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ════════════════════════
            TERRITORY TAB
        ════════════════════════ */}
        {activeTab === 'territory' && (
          <View>
            <View style={styles.territoryCard}>
              <Text style={styles.territoryZone}>{MOCK_TERRITORY.zoneName}</Text>
              <View style={styles.territoryRankRow}>
                <Text style={styles.territoryRank}>#{MOCK_TERRITORY.rank}</Text>
                <Text style={styles.territoryRankLabel}> IN ZONE</Text>
              </View>
              <View style={styles.territoryBar}>
                <View
                  style={[
                    styles.territoryBarFill,
                    { width: `${(MOCK_TERRITORY.solveCount / MOCK_TERRITORY.totalInZone) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.territoryProgress}>
                {MOCK_TERRITORY.solveCount} / {MOCK_TERRITORY.totalInZone} traces solved
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ZONE ACTIVITY</Text>
            </View>

            {/* Placeholder grid */}
            <View style={styles.photoGrid}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={styles.photoCell}>
                  <View style={styles.photoCellInner}>
                    <Text style={styles.photoCellIcon}>📍</Text>
                    <View
                      style={[
                        styles.photoCellDot,
                        {
                          backgroundColor:
                            i % 3 === 0 ? COLORS.amber : i % 3 === 1 ? COLORS.green : COLORS.concrete,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  scroll: {
    paddingBottom: 48,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  headerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.concrete,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 26,
    color: COLORS.ghost,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  streakLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.concrete,
    letterSpacing: 2,
  },
  streakCount: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 24,
    color: COLORS.amber,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 24,
  },
  tab: {
    paddingBottom: 6,
    position: 'relative',
  },
  tabText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: COLORS.concrete,
    letterSpacing: 1.5,
  },
  tabTextActive: {
    color: COLORS.amber,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.amber,
  },

  // Section labels
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 24,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.concrete,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.classified,
  },

  // Stage stepper (demo)
  stageStepper: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 8,
  },
  stageBtn: {
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.navyLight,
    borderRadius: 2,
    alignItems: 'center',
  },
  stageBtnActive: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.navyMid,
  },
  stageBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.concrete,
    letterSpacing: 1,
  },
  stageBtnTextActive: {
    color: COLORS.amber,
  },
  stageHint: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.concrete,
    opacity: 0.4,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },

  // Pins row
  pinsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 24,
    marginBottom: 8,
  },
  pinsHint: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.concrete,
    opacity: 0.4,
    textAlign: 'center',
    marginBottom: 4,
  },

  // Nearby list
  nearbyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: COLORS.navyMid,
    borderRadius: 4,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.navyLight,
  },
  nearbyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nearbyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nearbyLabel: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: COLORS.ghost,
    letterSpacing: 1,
  },
  nearbyDiff: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.concrete,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  nearbyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearbyDistance: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  nearbyArrow: {
    fontFamily: FONTS.uiBold,
    fontSize: 18,
    color: COLORS.concrete,
  },

  // Territory
  territoryCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.navyMid,
    borderRadius: 4,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  territoryZone: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 22,
    color: COLORS.ghost,
    marginBottom: 4,
  },
  territoryRankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  territoryRank: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 32,
    color: COLORS.amber,
  },
  territoryRankLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.concrete,
    letterSpacing: 2,
  },
  territoryBar: {
    height: 3,
    backgroundColor: COLORS.navyLight,
    borderRadius: 2,
    marginBottom: 8,
  },
  territoryBarFill: {
    height: 3,
    backgroundColor: COLORS.amber,
    borderRadius: 2,
  },
  territoryProgress: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.concrete,
    letterSpacing: 1,
  },

  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    gap: 6,
  },
  photoCell: {
    width: '31.5%',
    aspectRatio: 1,
  },
  photoCellInner: {
    flex: 1,
    backgroundColor: COLORS.navyMid,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCellIcon: {
    fontSize: 24,
  },
  photoCellDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
