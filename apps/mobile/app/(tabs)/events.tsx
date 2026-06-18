import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { supabase } from '@/lib/supabase';

type Tab = 'leaderboard' | 'bounties';

type LeaderEntry = {
  user_id: string;
  username: string;
  solve_count: number;
  rank: number;
};

type Bounty = {
  id: string;
  xp_stake: number;
  expires_at: string;
  traces: { place_name: string; difficulty: string } | null;
  posted_by_user: { username: string } | null;
};

function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_zone_leaderboard', { p_limit: 20 });
      if (error) throw error;
      return (data ?? []) as LeaderEntry[];
    },
    staleTime: 60_000,
  });
}

function useBounties() {
  return useQuery({
    queryKey: ['bounties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bounties')
        .select(`
          id, xp_stake, expires_at,
          traces ( place_name, difficulty ),
          users!bounties_posted_by_fkey ( username )
        `)
        .eq('status', 'active')
        .order('xp_stake', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Bounty[];
    },
    staleTime: 30_000,
  });
}

const DIFF_COLOR: Record<string, string> = {
  easy: COLORS.green,
  medium: COLORS.amber,
  hard: COLORS.classified,
  legendary: COLORS.purple,
};

function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ArenaScreen() {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const { data: leaders = [], isLoading: loadingL } = useLeaderboard();
  const { data: bounties = [], isLoading: loadingB } = useBounties();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ARENA</Text>
        <Text style={styles.headerTitle}>Compete</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['leaderboard', 'bounties'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={styles.tab} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'leaderboard' ? 'LEADERBOARD' : 'BOUNTY BOARD'}
            </Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Leaderboard ── */}
        {tab === 'leaderboard' && (
          loadingL ? <ActivityIndicator color={COLORS.amber} style={styles.loader} /> :
          leaders.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No solves yet.</Text>
              <Text style={styles.emptySub}>Be the first to crack a trace.</Text>
            </View>
          ) : leaders.map((entry) => (
            <View key={entry.user_id} style={[styles.leaderRow, entry.rank === 1 && styles.leaderRowFirst]}>
              <Text style={[styles.leaderRank, entry.rank <= 3 && { color: COLORS.amber }]}>
                #{entry.rank}
              </Text>
              <View style={styles.leaderLeft}>
                <View style={styles.leaderAvatar}>
                  <Text style={styles.leaderAvatarText}>
                    {entry.username[0]?.toUpperCase() ?? 'T'}
                  </Text>
                </View>
                <Text style={styles.leaderName}>{entry.username}</Text>
              </View>
              <View style={styles.leaderRight}>
                <Text style={styles.leaderCount}>{entry.solve_count}</Text>
                <Text style={styles.leaderCountLabel}>traces</Text>
              </View>
            </View>
          ))
        )}

        {/* ── Bounty Board ── */}
        {tab === 'bounties' && (
          loadingB ? <ActivityIndicator color={COLORS.amber} style={styles.loader} /> :
          bounties.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No active bounties.</Text>
              <Text style={styles.emptySub}>Stake XP on an unsolved trace to create one.</Text>
            </View>
          ) : bounties.map((bounty) => (
            <View key={bounty.id} style={styles.bountyCard}>
              <View style={styles.bountyTop}>
                <View style={styles.bountyXp}>
                  <Text style={styles.bountyXpValue}>{bounty.xp_stake}</Text>
                  <Text style={styles.bountyXpLabel}>XP</Text>
                </View>
                <View style={styles.bountyMeta}>
                  <Text style={styles.bountyDiff} style={[styles.bountyDiff, {
                    color: DIFF_COLOR[bounty.traces?.difficulty ?? 'easy']
                  }]}>
                    {bounty.traces?.difficulty?.toUpperCase() ?? '—'}
                  </Text>
                  <Text style={styles.bountyTime}>Expires in {timeUntil(bounty.expires_at)}</Text>
                </View>
              </View>
              <Text style={styles.bountyTraceName} numberOfLines={2}>
                {bounty.traces?.place_name ?? 'Unknown trace'}
              </Text>
              <Text style={styles.bountyPostedBy}>
                Posted by {bounty.posted_by_user?.username ?? 'unknown'}
              </Text>
              <TouchableOpacity style={styles.bountyBtn}>
                <Text style={styles.bountyBtnText}>Find it →</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete, letterSpacing: 3 },
  headerTitle: { fontFamily: FONTS.uiExtraBold, fontSize: 26, color: COLORS.ghost, marginTop: 2 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 24, marginBottom: 16, marginTop: 12 },
  tab: { paddingBottom: 6, position: 'relative' },
  tabText: { fontFamily: FONTS.monoBold, fontSize: 11, color: COLORS.concrete, letterSpacing: 1.5 },
  tabTextActive: { color: COLORS.amber },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.amber },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  loader: { marginTop: 48 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyText: { fontFamily: FONTS.uiBold, fontSize: 16, color: COLORS.ghost },
  emptySub: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete, textAlign: 'center', letterSpacing: 0.5 },

  // Leaderboard
  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.navyMid, borderRadius: 8,
    padding: 14, marginBottom: 8, gap: 12,
  },
  leaderRowFirst: { borderWidth: 1, borderColor: COLORS.amber },
  leaderRank: { fontFamily: FONTS.monoBold, fontSize: 14, color: COLORS.concrete, width: 32 },
  leaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.navyLight, alignItems: 'center', justifyContent: 'center',
  },
  leaderAvatarText: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.amber },
  leaderName: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.ghost },
  leaderRight: { alignItems: 'flex-end' },
  leaderCount: { fontFamily: FONTS.uiExtraBold, fontSize: 20, color: COLORS.ghost },
  leaderCountLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.concrete, letterSpacing: 1 },

  // Bounty
  bountyCard: {
    backgroundColor: COLORS.navyMid, borderRadius: 8,
    padding: 16, marginBottom: 12, gap: 8,
  },
  bountyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bountyXp: {
    backgroundColor: COLORS.navy, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.amber,
  },
  bountyXpValue: { fontFamily: FONTS.uiExtraBold, fontSize: 20, color: COLORS.amber },
  bountyXpLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.concrete, letterSpacing: 1 },
  bountyMeta: { flex: 1, gap: 4 },
  bountyDiff: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 1.5 },
  bountyTime: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete },
  bountyTraceName: { fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.ghost },
  bountyPostedBy: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete, letterSpacing: 0.5 },
  bountyBtn: {
    backgroundColor: COLORS.amber, borderRadius: 6,
    paddingVertical: 10, alignItems: 'center', marginTop: 4,
  },
  bountyBtnText: { fontFamily: FONTS.uiBold, fontSize: 13, color: COLORS.navy },
});
