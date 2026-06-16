import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { useChallengeStore } from '@/stores/challengeStore';
import { useUserStore } from '@/stores/userStore';

type Difficulty = 'easy' | 'medium' | 'hard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

type ChallengeState = 'waiting' | 'live' | 'missed' | 'completed';

const ARCHETYPE_COLORS: Record<string, string> = {
  detective: COLORS.amber,
  sprint: COLORS.red,
  hyperlocal: COLORS.green,
  narrative: COLORS.purple,
  social: COLORS.amber,
  detail: COLORS.green,
  condition_lock: COLORS.concrete,
};

const ARCHETYPE_EMOJI: Record<string, string> = {
  detective: '🔍',
  sprint: '⚡',
  hyperlocal: '📍',
  narrative: '📖',
  social: '👥',
  detail: '🎯',
  condition_lock: '🔒',
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

// Challenge drops at 09:00, 2hr window ends at 11:00.
// For dev: set state to 'live' by default.
const MOCK_DROP_TIME = dayjs().hour(9).minute(0).second(0);
const MOCK_WINDOW_END = MOCK_DROP_TIME.add(2, 'hour');
const MOCK_MINUTES_LEFT = Math.max(0, MOCK_WINDOW_END.diff(dayjs(), 'minute'));

const MOCK_CHALLENGE = {
  id: 'mock-1',
  city_id: 'tel-aviv',
  date: dayjs().format('YYYY-MM-DD'),
  archetype: 'detective' as const,
  verification_method: 'combined',
  easy: {
    challenge_narrative:
      "The city just dared you. You have two hours to prove you belong here.",
    title:
      'Find a building that still carries an original iron fixture above its entrance — a bracket, hook, ring, or mount from the era before neon. The Bauhaus district and the old port neighborhood have the highest density of survivors.',
    hint: 'Look at the space just above doorframes, especially on two and three-storey buildings from the 1920s-40s.',
    time_limit_mins: 90,
    radius_m: 600,
    points: 100,
  },
  medium: {
    title:
      'Find an original iron fixture above a building entrance — a bracket, hook, or mounting ring from before electricity reached the street. It must be on a building with visible pre-1960s architectural details: arched windows, original stone, or Bauhaus lines.',
    hint: 'The intersection of Rothschild Boulevard and the side streets south of Dizengoff Circle are good starting points.',
    time_limit_mins: 60,
    radius_m: 400,
    points: 200,
  },
  hard: {
    title:
      'Find an iron bracket or lamp mount above a building entrance where the original mounting bolts are still visible — not painted over, not replaced with concrete, but the actual original hardware. The building must show at least two other period details: original tile, arched entry, or Bauhaus relief.',
    hint: 'Old Jaffa and the northern edge of the original Tel Aviv grid. Look up, then look closer.',
    time_limit_mins: 30,
    radius_m: 200,
    points: 400,
  },
  vision_checks: [{ type: 'object', target: 'iron bracket door', confidence: 0.75 }],
  active_from: MOCK_DROP_TIME.toISOString(),
  active_until: MOCK_WINDOW_END.toISOString(),
};

// Dev default: LIVE
const MOCK_CHALLENGE_STATE: ChallengeState = 'live';

const MOCK_ACTIVE_EVENTS = [
  { id: '1', emoji: '⚔️', label: 'Head to head week', color: COLORS.amber },
  { id: '2', emoji: '🌍', label: 'City war', color: COLORS.red },
  { id: '3', emoji: '⛓️', label: 'Chain active', color: COLORS.green },
  { id: '4', emoji: '⚡', label: 'Critical dare in 3 days', color: COLORS.purple },
];

const MOCK_DUEL = {
  opponent: '@sara_tlv',
  opponentPhoto: null as string | null,
  myPhoto: null as string | null,
  votes: null as number | null,
};

const MOCK_RELAY = {
  position: 12,
  previousPhotos: [] as string[],
  myPhoto: null as string | null,
};

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = ['easy', 'medium', 'hard'] as const;
const DIFFICULTY_COLORS = {
  easy: COLORS.green,
  medium: COLORS.amber,
  hard: COLORS.red,
};
const DIFFICULTY_POINTS = { easy: 100, medium: 200, hard: 400 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTimerColor(remaining: number, total: number): string {
  const pct = remaining / total;
  if (pct <= 0.2) return COLORS.red;
  if (pct <= 0.5) return COLORS.amber;
  return COLORS.green;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Horizontally scrollable strip of active event pills */
function ActiveEventStrip() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.eventStripContent}
      style={styles.eventStrip}
    >
      {MOCK_ACTIVE_EVENTS.map((ev) => (
        <View key={ev.id} style={styles.eventPill}>
          <Text style={[styles.eventPillText, { color: ev.color }]}>
            {ev.emoji} {ev.label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

/** Pulsing LIVE badge — uses reanimated opacity loop */
function LiveBadge({ minutesLeft }: { minutesLeft: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.liveBadge, animStyle]}>
      <Text style={styles.liveBadgeText}>⚡ DARE ACTIVE · {minutesLeft} minutes left</Text>
    </Animated.View>
  );
}

/** State A — challenge hasn't dropped yet */
function WaitingCard() {
  const dropTime = MOCK_DROP_TIME;
  const nowSecs = dayjs().unix();
  const dropSecs = dropTime.unix();
  const midnightSecs = dayjs().startOf('day').unix();
  const progress = Math.min((nowSecs - midnightSecs) / (dropSecs - midnightSecs), 1);

  return (
    <View style={styles.challengeCard}>
      <View style={styles.waitingBody}>
        <Text style={styles.waitingClock}>🕐</Text>
        <Text style={styles.waitingLabel}>Your dare drops at</Text>
        <Text style={styles.waitingTime}>{dropTime.format('HH:mm')}</Text>
        <Text style={styles.waitingSubLabel}>Stay ready</Text>
        <View style={styles.waitingBarOuter}>
          <View style={[styles.waitingBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

/** State C — missed the window */
function MissedCard({ streak, shields }: { streak: number; shields: number }) {
  return (
    <View style={styles.challengeCard}>
      <View style={styles.missedBody}>
        <Text style={styles.missedEmoji}>😔</Text>
        <Text style={styles.missedTitle}>You missed the dare</Text>
        {streak > 0 && (
          <Text style={styles.missedStreakWarning}>
            Your streak ends tonight unless you submit
          </Text>
        )}
        {shields > 0 && (
          <TouchableOpacity style={styles.shieldButton} activeOpacity={0.8}>
            <Text style={styles.shieldButtonText}>🛡️ Use streak shield</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** State D — completed */
function CompletedCard({
  points,
  cityName,
  cityRank,
  chainUnlockEligible,
}: {
  points: number;
  cityName: string;
  cityRank: number;
  chainUnlockEligible: boolean;
}) {
  return (
    <View style={styles.challengeCard}>
      <View style={styles.completedBody}>
        <Text style={styles.completedCheck}>✓</Text>
        <Text style={styles.completedTitle}>Mission complete</Text>

        <View style={styles.completedPhotoRow}>
          {/* Photo thumbnail placeholder */}
          <View style={styles.completedThumb} />
          <View style={styles.completedMeta}>
            <Text style={styles.completedPoints}>+{points} pts</Text>
            <Text style={styles.completedRank}>#{cityRank} in {cityName}</Text>
          </View>
        </View>

        {chainUnlockEligible && (
          <TouchableOpacity style={styles.chainUnlockButton} activeOpacity={0.85}>
            <Text style={styles.chainUnlockButtonText}>CLASSIFIED unlocked →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Chain Unlock section (shown after completion) */
function ChainUnlockSection({ challengeTitle }: { challengeTitle: string }) {
  return (
    <View style={styles.chainUnlockCard}>
      <Text style={styles.chainUnlockLabel}>🔗 CLASSIFIED MISSION</Text>
      <Text style={styles.chainUnlockDesc}>You've earned access to a classified dare</Text>
      <Text style={styles.chainUnlockTitle}>{challengeTitle}</Text>
      <TouchableOpacity style={styles.chainAcceptButton} activeOpacity={0.85}>
        <Text style={styles.chainAcceptText}>Accept →</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Duel card */
function DuelCard() {
  const { opponent, myPhoto } = MOCK_DUEL;
  return (
    <View style={styles.eventCard}>
      <Text style={styles.duelLabel}>⚔️ HEAD TO HEAD</Text>
      <Text style={styles.eventCardOpponent}>{opponent}</Text>
      <Text style={styles.vsText}>vs</Text>
      <Text style={styles.eventCardSub}>
        {myPhoto ? 'Waiting for votes' : 'Submit first →'}
      </Text>
    </View>
  );
}

/** Relay card */
function RelayCard() {
  const { position, myPhoto } = MOCK_RELAY;
  return (
    <View style={styles.eventCard}>
      <Text style={styles.relayLabel}>⛓️ CHAIN</Text>
      <Text style={styles.eventCardOpponent}>You're link #{position}</Text>
      <View style={styles.relayPhotoStrip}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.relayPhotoThumb} />
        ))}
      </View>
      <Text style={styles.eventCardSub}>
        {myPhoto ? '✓ Linked' : 'Add your link →'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Live Challenge Card (State B)
// ---------------------------------------------------------------------------

function LiveChallengeCard({
  challenge,
  minutesLeft,
  selectedDifficulty,
  selectDifficulty,
  challengeAccepted,
  acceptChallenge,
  timeRemaining,
  timeLimitSecs,
}: {
  challenge: typeof MOCK_CHALLENGE;
  minutesLeft: number;
  selectedDifficulty: Difficulty;
  selectDifficulty: (d: Difficulty) => void;
  challengeAccepted: boolean;
  acceptChallenge: () => void;
  timeRemaining: number;
  timeLimitSecs: number;
}) {
  const [showReveal, setShowReveal] = useState(false);

  const archetypeColor = ARCHETYPE_COLORS[challenge.archetype] ?? COLORS.amber;
  const archetypeEmoji = ARCHETYPE_EMOJI[challenge.archetype] ?? '🔍';

  const tier = challenge[selectedDifficulty as keyof typeof challenge] as
    | { title: string; hint: string; time_limit_mins: number; radius_m: number; points: number; challenge_narrative?: string }
    | undefined;

  const title = tier?.title ?? challenge.easy.title;
  const hint = tier?.hint ?? challenge.easy.hint;
  const radius_m = (tier as { radius_m?: number } | undefined)?.radius_m ?? challenge.easy.radius_m;
  const time_limit_mins = (tier as { time_limit_mins?: number } | undefined)?.time_limit_mins ?? challenge.easy.time_limit_mins;
  const challenge_narrative = challenge.easy.challenge_narrative;
  const timerColor = getTimerColor(timeRemaining, timeLimitSecs);

  return (
    <>
      <View style={styles.challengeCard}>
        <LiveBadge minutesLeft={minutesLeft} />

        {/* Difficulty selector */}
        <View style={styles.difficultyRow}>
          {DIFFICULTY_LABELS.map((d) => {
            const active = selectedDifficulty === d;
            const color = DIFFICULTY_COLORS[d];
            return (
              <TouchableOpacity
                key={d}
                style={styles.difficultyTab}
                onPress={() => selectDifficulty(d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.difficultyText, { color: active ? color : COLORS.concrete }]}>
                  {d.toUpperCase()}
                </Text>
                <Text style={[styles.difficultyPoints, { color: active ? color : COLORS.concrete }]}>
                  +{DIFFICULTY_POINTS[d]}
                </Text>
                {active && <View style={[styles.difficultyUnderline, { backgroundColor: color }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          <View style={styles.archetypeRow}>
            <Text style={styles.archetypeEmoji}>{archetypeEmoji}</Text>
            <Text style={styles.archetypeLabel}>{challenge.archetype.replace('_', ' ').toUpperCase()}</Text>
          </View>

          {/* Mission Briefing */}
          {!challengeAccepted && challenge_narrative && (
            <View style={[styles.missionBriefing, { borderLeftColor: archetypeColor }]}>
              <Text style={[styles.missionBriefingLabel, { color: archetypeColor }]}>
                Mission Briefing
              </Text>
              <Text style={styles.missionBriefingText}>{challenge_narrative}</Text>
            </View>
          )}

          <Text style={styles.challengeTitle}>{title}</Text>
          <Text style={styles.challengeDetail}>
            Within {radius_m}m · {time_limit_mins} min · proof required
          </Text>

          <View style={styles.hintBox}>
            <Text style={styles.hintLabel}>HINT</Text>
            <Text style={styles.hintText}>{hint}</Text>
          </View>

          {challengeAccepted && (
            <View style={styles.timerBlock}>
              <Text style={styles.timerLabel}>MISSION CLOCK</Text>
              <Text style={[styles.timerValue, { color: timerColor }]}>{formatTime(timeRemaining)}</Text>
              <View style={styles.timerBarOuter}>
                <View
                  style={[
                    styles.timerBarFill,
                    { width: `${(timeRemaining / timeLimitSecs) * 100}%`, backgroundColor: timerColor },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Submit photo button (large amber, visible in LIVE state) */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => {
              if (!challengeAccepted) {
                setShowReveal(true);
              }
              // camera/submit action handled by floating button or router in parent
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>
              {challengeAccepted ? 'Submit proof →' : "Accept your dare"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PolaroidReveal overlay */}
      {showReveal && (
        <Modal transparent animationType="fade" visible={showReveal}>
          <View style={styles.revealOverlay}>
            <View style={styles.revealCard}>
              <Text style={styles.revealDareLabel}>TODAY'S DARE</Text>
              <Text style={styles.revealEmoji}>{archetypeEmoji}</Text>
              <Text style={styles.revealTitle}>{title}</Text>
              <TouchableOpacity
                style={styles.revealAccept}
                onPress={() => {
                  acceptChallenge();
                  setShowReveal(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.revealAcceptText}>Accept the dare →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowReveal(false)} style={styles.revealDismiss}>
                <Text style={styles.revealDismissText}>Not today</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TodayScreen() {
  const router = useRouter();
  const {
    todayChallenge,
    selectedDifficulty,
    challengeAccepted,
    selectDifficulty,
    acceptChallenge,
    getTimeRemaining,
    getActiveTier,
  } = useChallengeStore();
  const { user } = useUserStore();

  const challenge = todayChallenge ?? MOCK_CHALLENGE;

  // For dev: force LIVE state. In production this would be derived from challenge timestamps.
  const challengeState: ChallengeState = MOCK_CHALLENGE_STATE;

  const [timeRemaining, setTimeRemaining] = useState(0);

  const activeTier = getActiveTier() ??
    (challenge[selectedDifficulty as keyof typeof challenge] as {
      title: string;
      hint: string;
      time_limit_mins: number;
      radius_m: number;
      points: number;
    });

  useEffect(() => {
    if (!challengeAccepted) return;
    setTimeRemaining(getTimeRemaining());
    const id = setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 1000);
    return () => clearInterval(id);
  }, [challengeAccepted]);

  const timeLimitSecs =
    typeof activeTier === 'object' && activeTier && 'time_limit_mins' in activeTier
      ? (activeTier as { time_limit_mins: number }).time_limit_mins * 60
      : 3600;

  const xp = user?.xp ?? 1250;
  const nextXP = 1500;
  const currentLevelXP = 500;
  const levelProgress = Math.min((xp - currentLevelXP) / (nextXP - currentLevelXP), 1);
  const levelName = user?.level?.toUpperCase() ?? 'WANDERER';
  const streak = user?.streak_current ?? 47;
  const shields = 2; // mock
  const cityName = user?.city_id?.replace('-', ' ')?.toUpperCase() ?? 'TEL AVIV';

  const isLive = challengeState === 'live';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.cityLabel}>{cityName}</Text>
            <Text style={styles.goneLogo}>DARE</Text>
          </View>
          <View style={styles.streakBlock}>
            <Text style={styles.streakLabel}>RUN</Text>
            <Text style={styles.streakValue}>🔥 {streak}</Text>
          </View>
        </View>

        {/* Level Bar */}
        <View style={styles.levelBarRow}>
          <Text style={styles.levelName}>{levelName}</Text>
          <Text style={styles.xpLabel}>{xp} / {nextXP} XP</Text>
        </View>
        <View style={styles.levelBarOuter}>
          <View style={[styles.levelBarFill, { width: `${levelProgress * 100}%` }]} />
        </View>

        {/* Active event pills */}
        <ActiveEventStrip />

        {/* Challenge card — varies by state */}
        {challengeState === 'waiting' && <WaitingCard />}

        {challengeState === 'live' && (
          <LiveChallengeCard
            challenge={challenge as typeof MOCK_CHALLENGE}
            minutesLeft={MOCK_MINUTES_LEFT}
            selectedDifficulty={selectedDifficulty}
            selectDifficulty={selectDifficulty}
            challengeAccepted={challengeAccepted}
            acceptChallenge={acceptChallenge}
            timeRemaining={timeRemaining}
            timeLimitSecs={timeLimitSecs}
          />
        )}

        {challengeState === 'missed' && (
          <MissedCard streak={streak} shields={shields} />
        )}

        {challengeState === 'completed' && (
          <>
            <CompletedCard
              points={200}
              cityName={cityName}
              cityRank={47}
              chainUnlockEligible
            />
            <ChainUnlockSection challengeTitle={(challenge.easy as any).title ?? 'Classified mission'} />
          </>
        )}

        {/* Active events row — Duel + Relay */}
        <View style={styles.eventsRow}>
          <DuelCard />
          <RelayCard />
        </View>

        {/* Stats Strip */}
        <View style={styles.statsStrip}>
          {[
            { value: '128', label: 'Dares completed' },
            { value: '#47', label: 'City rank' },
            { value: '14h', label: 'Hours remaining' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating camera button — visible only when LIVE */}
      {isLive && (
        <Pressable
          style={styles.floatingCamera}
          onPress={() => router.push('/(tabs)/submit' as never)}
          accessibilityLabel="Submit challenge photo"
          accessibilityRole="button"
        >
          <Text style={styles.floatingCameraEmoji}>📷</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Header
  header: {
    backgroundColor: COLORS.navyMid,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cityLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
  },
  goneLogo: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.ghost,
  },
  streakBlock: {
    alignItems: 'flex-end',
  },
  streakLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
  },
  streakValue: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.amber,
  },

  // Level bar
  levelBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  levelName: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.amber,
    textTransform: 'uppercase',
  },
  xpLabel: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.concrete,
  },
  levelBarOuter: {
    marginHorizontal: 20,
    marginBottom: 8,
    height: 3,
    backgroundColor: COLORS.navyLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: 3,
    backgroundColor: COLORS.amber,
    borderRadius: 2,
  },

  // Active event strip
  eventStrip: {
    marginTop: 12,
    marginBottom: 4,
  },
  eventStripContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  eventPill: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 0,
  },
  eventPillText: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },

  // Shared card shell
  challengeCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    overflow: 'hidden',
  },

  // Live badge
  liveBadge: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  liveBadgeText: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.ghost,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Difficulty selector
  difficultyRow: {
    flexDirection: 'row',
  },
  difficultyTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  difficultyText: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  difficultyPoints: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 2,
  },
  difficultyUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
  },

  // Card body
  cardBody: {
    padding: 24,
  },
  archetypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  archetypeEmoji: {
    fontSize: 14,
  },
  archetypeLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
  },
  missionBriefing: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
    borderLeftWidth: 3,
  },
  missionBriefingLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  missionBriefingText: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.ghost,
  },
  challengeTitle: {
    fontFamily: FONTS.challenge,
    fontSize: 18,
    lineHeight: 28,
    color: COLORS.ghost,
    marginTop: 8,
  },
  challengeDetail: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.concrete,
    marginTop: 6,
  },
  hintBox: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
    padding: 12,
    marginTop: 16,
  },
  hintLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.amber,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hintText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.concrete,
  },
  timerBlock: {
    marginTop: 16,
  },
  timerLabel: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timerValue: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 32,
    letterSpacing: 2,
  },
  timerBarOuter: {
    height: 4,
    backgroundColor: COLORS.navyLight,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: 4,
    borderRadius: 2,
  },
  submitButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: COLORS.amber,
  },
  submitButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },

  // Waiting state
  waitingBody: {
    padding: 32,
    alignItems: 'center',
  },
  waitingClock: {
    fontSize: 40,
    marginBottom: 12,
  },
  waitingLabel: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: COLORS.concrete,
    textAlign: 'center',
    marginBottom: 4,
  },
  waitingTime: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.amber,
    marginBottom: 4,
  },
  waitingSubLabel: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
    marginBottom: 20,
  },
  waitingBarOuter: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.navyLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  waitingBarFill: {
    height: 4,
    backgroundColor: COLORS.amber,
    borderRadius: 2,
  },

  // Missed state
  missedBody: {
    padding: 32,
    alignItems: 'center',
  },
  missedEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  missedTitle: {
    fontFamily: FONTS.uiBold,
    fontSize: 16,
    color: COLORS.ghost,
    textAlign: 'center',
    marginBottom: 8,
  },
  missedStreakWarning: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 16,
  },
  shieldButton: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  shieldButtonText: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
  },

  // Completed state
  completedBody: {
    padding: 24,
    alignItems: 'center',
  },
  completedCheck: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 32,
    color: COLORS.green,
    marginBottom: 4,
  },
  completedTitle: {
    fontFamily: FONTS.uiBold,
    fontSize: 16,
    color: COLORS.green,
    marginBottom: 16,
  },
  completedPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  completedThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.navyLight,
  },
  completedMeta: {
    gap: 4,
  },
  completedPoints: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20,
    color: COLORS.amber,
  },
  completedRank: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
  },
  chainUnlockButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  chainUnlockButtonText: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.amber,
  },

  // Chain unlock section
  chainUnlockCard: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderStyle: 'dashed',
  },
  chainUnlockLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 4,
  },
  chainUnlockDesc: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
    marginBottom: 8,
  },
  chainUnlockTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16,
    color: COLORS.ghost,
    lineHeight: 24,
    marginBottom: 12,
  },
  chainAcceptButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  chainAcceptText: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.navy,
  },

  // Active events row
  eventsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 8,
  },
  eventCard: {
    flex: 1,
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  duelLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  relayLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.green,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  eventCardOpponent: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
  },
  vsText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventCardSub: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.concrete,
  },
  relayPhotoStrip: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 4,
  },
  relayPhotoThumb: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: COLORS.navyLight,
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 22,
    color: COLORS.ghost,
  },
  statLabel: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Floating camera button
  floatingCamera: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingCameraEmoji: {
    fontSize: 28,
  },

  // Reveal modal
  revealOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,14,26,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  revealCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    alignItems: 'center',
  },
  revealDareLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  revealEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  revealTitle: {
    fontFamily: FONTS.challenge,
    fontSize: 22,
    lineHeight: 32,
    color: COLORS.ghost,
    textAlign: 'center',
    marginBottom: 32,
  },
  revealAccept: {
    backgroundColor: COLORS.amber,
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  revealAcceptText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },
  revealDismiss: {
    marginTop: 16,
    padding: 8,
  },
  revealDismissText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: COLORS.concrete,
  },
});
