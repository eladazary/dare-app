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
import { useUserStore } from '@/stores/userStore';
import { BADGES } from '@/constants/badges';
import { useSocialStore } from '@/stores/socialStore';

const MOCK_BADGES = [
  { id: 'lightning', earned: true },
  { id: 'early_bird', earned: true },
  { id: 'streak_7', earned: true },
  { id: 'waterproof', earned: false },
  { id: 'streak_30', earned: false },
  { id: 'perfectionist', earned: false },
  { id: 'night_owl', earned: true },
  { id: 'explorer', earned: false },
];

const MOCK_STATS = {
  streak: 47,
  rank: 12,
  totalXP: 4250,
};

const GONE_PLUS_FEATURES = [
  '· See tomorrow\'s challenge preview',
  '· Streak shields (3/month)',
  '· City leaderboard history',
  '· Priority AI verification',
];

const MOCK_CREW = {
  inCrew: true,
  name: 'Tel Aviv Originals',
  memberCount: 8,
  cityRank: 3,
  members: ['T', 'R', 'A', 'M'],
};

const MOCK_REFERRAL = {
  inviteCount: 4,
  referralCode: 'GONE-ELAD',
  builderThreshold: 10,
  architectThreshold: 25,
  legendThreshold: 50,
};

export default function ProfileScreen() {
  const { user } = useUserStore();
  const { crew } = useSocialStore();
  const [gonePlusExpanded, setGonePlusExpanded] = useState(false);

  // Use store crew presence to gate display; fall back to MOCK_CREW for UI fields
  const hasCrew = crew !== null || MOCK_CREW.inCrew;
  const crewData = hasCrew ? MOCK_CREW : null;
  const inviteCount = MOCK_REFERRAL.inviteCount;
  const referralCode = MOCK_REFERRAL.referralCode;
  const builderProgress = Math.min(inviteCount / MOCK_REFERRAL.builderThreshold, 1);

  const username = user?.username ?? 'wanderer47';
  const level = user?.level?.toUpperCase() ?? 'WANDERER';
  const xp = user?.xp ?? 4250;
  const streak = user?.streak_current ?? MOCK_STATS.streak;
  const initial = username[0]?.toUpperCase() ?? 'W';

  const levelXP = 4000;
  const nextLevelXP = 4500;
  const levelProgress = Math.min((xp - levelXP) / (nextLevelXP - levelXP), 1);
  const xpUntilNext = nextLevelXP - xp;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.levelCity}>{level} · TEL AVIV</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>🔥 {streak}</Text>
            <Text style={styles.statLabel}>RUN</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>#{MOCK_STATS.rank}</Text>
            <Text style={styles.statLabel}>CITY RANK</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{xp.toLocaleString()}</Text>
            <Text style={styles.statLabel}>TOTAL XP</Text>
          </View>
        </View>

        {/* Crew Section */}
        <View style={styles.crewCard}>
          {crewData ? (
            <>
              <Text style={styles.crewLabel}>🫂 YOUR SQUAD</Text>
              <Text style={styles.crewName}>{crewData.name}</Text>
              <Text style={styles.crewMeta}>
                {crewData.memberCount} members · #{crewData.cityRank} city rank
              </Text>
              <View style={styles.crewAvatarRow}>
                {MOCK_CREW.members.map((letter, i) => (
                  <View key={i} style={styles.crewAvatar}>
                    <Text style={styles.crewAvatarInitial}>{letter}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.crewNoCrewTitle}>🫂 Start or join a squad</Text>
              <Text style={styles.crewNoCrewSub}>
                Squads earn passive XP from every member's dare
              </Text>
              <TouchableOpacity style={styles.crewButton} activeOpacity={0.85}>
                <Text style={styles.crewButtonText}>Form a squad →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Level Progress */}
        <View style={styles.levelCard}>
          <View style={styles.levelRow}>
            <Text style={styles.levelCurrent}>RECRUIT</Text>
            <Text style={styles.levelNext}>AGENT</Text>
          </View>
          <View style={styles.levelBarOuter}>
            <View style={[styles.levelBarFill, { width: `${levelProgress * 100}%` }]} />
          </View>
          <Text style={styles.levelHint}>{xpUntilNext} XP until next rank</Text>
        </View>

        {/* Badges */}
        <View style={styles.badgeSection}>
          <Text style={styles.badgeSectionLabel}>COMMENDATIONS</Text>
          <View style={styles.badgeGrid}>
            {MOCK_BADGES.map((entry) => {
              const def = BADGES.find((b) => b.id === entry.id);
              if (!def) return null;
              return (
                <View
                  key={entry.id}
                  style={[styles.badgeCard, !entry.earned && styles.badgeCardLocked]}
                >
                  <Text style={styles.badgeEmoji}>{def.emoji}</Text>
                  <View style={styles.badgeInfo}>
                    <Text style={[styles.badgeName, !entry.earned && styles.badgeTextLocked]}>
                      {def.name}
                    </Text>
                    <Text style={[styles.badgeDesc, !entry.earned && styles.badgeTextLocked]}>
                      {def.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Referral Section */}
        <View style={styles.referralCard}>
          <Text style={styles.referralLabel}>RECRUIT AGENTS</Text>
          <Text style={styles.referralTagline}>
            {inviteCount} agents recruited to Tel Aviv
          </Text>

          {/* Founder tier progress */}
          <View style={styles.referralTierRow}>
            <Text style={styles.referralTierText}>Recruiter (10)</Text>
            <Text style={styles.referralTierSep}>→</Text>
            <Text style={styles.referralTierText}>Commander (25)</Text>
            <Text style={styles.referralTierSep}>→</Text>
            <Text style={styles.referralTierText}>Legend Maker (50)</Text>
          </View>
          <View style={styles.referralBarOuter}>
            <View style={[styles.referralBarFill, { width: `${builderProgress * 100}%` as any }]} />
          </View>
          <Text style={styles.referralFraction}>
            {inviteCount}/{MOCK_REFERRAL.builderThreshold}
          </Text>

          {/* Code box */}
          <View style={styles.referralCodeBox}>
            <Text style={styles.referralCode}>{referralCode}</Text>
            <Text style={styles.referralCodeHint}>Copy &amp; share</Text>
          </View>

          <TouchableOpacity style={styles.referralShareButton} activeOpacity={0.85}>
            <Text style={styles.referralShareButtonText}>Send recruitment link →</Text>
          </TouchableOpacity>
        </View>

        {/* Gone+ Card */}
        <TouchableOpacity
          style={styles.gonePlusCard}
          onPress={() => setGonePlusExpanded((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.gonePlusHeader}>
            <Text style={styles.gonePlusTitle}>DARE+</Text>
            <Text style={styles.gonePlusCta}>7-day free trial →</Text>
          </View>
          {gonePlusExpanded && (
            <View style={styles.gonePlusBody}>
              {GONE_PLUS_FEATURES.map((f) => (
                <Text key={f} style={styles.gonePlusFeature}>{f}</Text>
              ))}
              <TouchableOpacity style={styles.gonePlusButton} activeOpacity={0.85}>
                <Text style={styles.gonePlusButtonText}>Go Dare+</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: COLORS.navyMid,
    paddingVertical: 32,
    alignItems: 'center',
  },
  avatarContainer: {
    padding: 3,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: COLORS.amber,
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.ghost,
  },
  username: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 18,
    color: COLORS.ghost,
  },
  levelCity: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.amber,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
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
  },
  levelCard: {
    backgroundColor: COLORS.navyMid,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelCurrent: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.amber,
    textTransform: 'uppercase',
  },
  levelNext: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.concrete,
    textTransform: 'uppercase',
  },
  levelBarOuter: {
    height: 6,
    backgroundColor: COLORS.navyLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: 6,
    backgroundColor: COLORS.amber,
    borderRadius: 3,
    width: '83%',
  },
  levelHint: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
    marginTop: 8,
  },
  badgeSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  badgeSectionLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  badgeGrid: {
    gap: 8,
  },
  badgeCard: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeCardLocked: {
    opacity: 0.35,
  },
  badgeEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  badgeInfo: {
    flex: 1,
    gap: 2,
  },
  badgeName: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
    color: COLORS.ghost,
  },
  badgeDesc: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
    lineHeight: 16,
  },
  badgeTextLocked: {
    color: COLORS.concrete,
  },
  // Crew
  crewCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    gap: 6,
  },
  crewLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  crewName: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 16,
    color: COLORS.ghost,
  },
  crewMeta: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.concrete,
  },
  crewAvatarRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  crewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewAvatarInitial: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
    color: COLORS.ghost,
  },
  crewNoCrewTitle: {
    fontFamily: FONTS.uiBold,
    fontSize: 15,
    color: COLORS.ghost,
  },
  crewNoCrewSub: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.concrete,
    lineHeight: 18,
  },
  crewButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  crewButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 14,
    color: COLORS.navy,
  },
  // Referral
  referralCard: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    gap: 8,
  },
  referralLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  referralTagline: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
    lineHeight: 20,
  },
  referralTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  referralTierText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  referralTierSep: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  referralBarOuter: {
    height: 6,
    backgroundColor: COLORS.navyMid,
    borderRadius: 3,
    overflow: 'hidden',
  },
  referralBarFill: {
    height: 6,
    backgroundColor: COLORS.amber,
    borderRadius: 3,
  },
  referralFraction: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  referralCodeBox: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  referralCode: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20,
    color: COLORS.ghost,
    letterSpacing: 4,
  },
  referralCodeHint: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  referralShareButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  referralShareButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },
  gonePlusCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.amber,
    overflow: 'hidden',
  },
  gonePlusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  gonePlusTitle: {
    fontFamily: FONTS.uiBold,
    fontSize: 15,
    color: COLORS.amber,
  },
  gonePlusCta: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.amber,
  },
  gonePlusBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.navyLight,
    padding: 16,
    gap: 8,
  },
  gonePlusFeature: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
    lineHeight: 20,
  },
  gonePlusButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  gonePlusButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },
});
