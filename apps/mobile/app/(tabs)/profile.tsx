import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

type Profile = {
  username: string;
  xp: number;
  streak_current: number;
  streak_best: number;
  level: string;
  total_traces_solved: number;
  territory_count: number;
};

const LEVELS = [
  { key: 'wanderer', label: 'Recruit',    minXp: 0 },
  { key: 'scout',    label: 'Agent',      minXp: 500 },
  { key: 'explorer', label: 'Operative',  minXp: 2000 },
  { key: 'chronicler',label: 'Field Agent',minXp: 5000 },
  { key: 'keeper',   label: 'Handler',    minXp: 12000 },
  { key: 'legend',   label: 'Legend',     minXp: 30000 },
];

function getLevelLabel(xp: number) {
  const level = [...LEVELS].reverse().find(l => xp >= l.minXp);
  return level?.label ?? 'Recruit';
}

function getNextLevel(xp: number) {
  return LEVELS.find(l => xp < l.minXp);
}

function xpProgress(xp: number) {
  const curr = [...LEVELS].reverse().find(l => xp >= l.minXp);
  const next = getNextLevel(xp);
  if (!next || !curr) return 1;
  return (xp - curr.minXp) / (next.minXp - curr.minXp);
}

export default function ProfileScreen() {
  const { session, preview } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [solveCount, setSolveCount] = useState(0);

  useEffect(() => {
    loadProfile();
  }, [session]);

  const loadProfile = async () => {
    setLoading(true);
    if (!session && !preview) { setLoading(false); return; }

    if (session) {
      const { data: user } = await supabase
        .from('users')
        .select('username, xp, streak_current, streak_best, level, total_traces_solved, territory_count')
        .eq('auth_id', session.user.id)
        .single();

      const { count } = await supabase
        .from('trace_solves')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id ?? '');

      setProfile(user);
      setSolveCount(count ?? 0);
    } else {
      // Preview mode mock
      setProfile({
        username: 'agent_preview',
        xp: 1240,
        streak_current: 7,
        streak_best: 23,
        level: 'scout',
        total_traces_solved: 0,
        territory_count: 0,
      });
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={COLORS.amber} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.noAuthText}>Sign in to see your profile.</Text>
      </View>
    );
  }

  const levelLabel = getLevelLabel(profile.xp);
  const nextLevel = getNextLevel(profile.xp);
  const progress = xpProgress(profile.xp);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.username[0]?.toUpperCase() ?? 'A'}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.username}>{profile.username}</Text>
            <Text style={styles.levelLabel}>{levelLabel.toUpperCase()}</Text>
          </View>
          {session && (
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* XP bar */}
        <View style={styles.xpSection}>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpValue}>{profile.xp.toLocaleString()} XP</Text>
            {nextLevel && (
              <Text style={styles.xpNext}>{nextLevel.label} at {nextLevel.minXp.toLocaleString()}</Text>
            )}
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.streak_current}</Text>
            <Text style={styles.statLabel}>ACTIVE RUN</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.streak_best}</Text>
            <Text style={styles.statLabel}>BEST RUN</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{solveCount}</Text>
            <Text style={styles.statLabel}>TRACES FOUND</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.territory_count}</Text>
            <Text style={styles.statLabel}>ZONES OWNED</Text>
          </View>
        </View>

        {/* Streak visual */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <View style={styles.streakDots}>
            {['M','T','W','T','F','S','S'].map((day, i) => (
              <View key={i} style={styles.streakDay}>
                <View style={[
                  styles.streakDot,
                  i < (profile.streak_current % 7) && styles.streakDotActive,
                ]} />
                <Text style={styles.streakDayLabel}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Commendations placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMMENDATIONS</Text>
          <View style={styles.badgeGrid}>
            {['🏅','⚡','🔍','🌍','⚔️','🚩','🏆','🌙'].map((emoji, i) => (
              <View key={i} style={[styles.badge, i >= 3 && styles.badgeLocked]}>
                <Text style={styles.badgeEmoji}>{emoji}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { paddingBottom: 48 },
  centerFill: {
    flex: 1, backgroundColor: COLORS.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  noAuthText: {
    fontFamily: FONTS.mono, fontSize: 13,
    color: COLORS.concrete, letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.navyMid,
    borderWidth: 2, borderColor: COLORS.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 22, color: COLORS.amber,
  },
  headerText: { flex: 1 },
  username: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20, color: COLORS.ghost,
  },
  levelLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10, color: COLORS.amber,
    letterSpacing: 2, marginTop: 2,
  },
  signOutBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.navyLight,
    borderRadius: 4,
  },
  signOutText: {
    fontFamily: FONTS.mono, fontSize: 10,
    color: COLORS.concrete, letterSpacing: 1,
  },
  xpSection: {
    marginHorizontal: 20, marginBottom: 24,
  },
  xpLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 8,
  },
  xpValue: {
    fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.ghost,
  },
  xpNext: {
    fontFamily: FONTS.mono, fontSize: 10,
    color: COLORS.concrete, letterSpacing: 0.5,
  },
  xpBarBg: {
    height: 4, backgroundColor: COLORS.navyLight,
    borderRadius: 2,
  },
  xpBarFill: {
    height: 4, backgroundColor: COLORS.amber,
    borderRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 20, gap: 10, marginBottom: 24,
  },
  statCard: {
    width: '47%', backgroundColor: COLORS.navyMid,
    borderRadius: 8, padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 32, color: COLORS.ghost,
  },
  statLabel: {
    fontFamily: FONTS.mono, fontSize: 9,
    color: COLORS.concrete, letterSpacing: 2,
    marginTop: 4,
  },
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionLabel: {
    fontFamily: FONTS.mono, fontSize: 9,
    color: COLORS.concrete, letterSpacing: 3,
    marginBottom: 12,
  },
  streakDots: {
    flexDirection: 'row', gap: 8,
  },
  streakDay: { alignItems: 'center', gap: 4 },
  streakDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.navyMid,
    borderWidth: 1, borderColor: COLORS.navyLight,
  },
  streakDotActive: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  streakDayLabel: {
    fontFamily: FONTS.mono, fontSize: 9,
    color: COLORS.concrete,
  },
  badgeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  badge: {
    width: 56, height: 56, borderRadius: 8,
    backgroundColor: COLORS.navyMid,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.navyLight,
  },
  badgeLocked: { opacity: 0.25 },
  badgeEmoji: { fontSize: 24 },
});
