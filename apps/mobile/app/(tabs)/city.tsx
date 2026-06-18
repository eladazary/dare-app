import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { supabase } from '@/lib/supabase';

type SolveFeedItem = {
  id: string;
  created_at: string;
  time_to_solve_seconds: number;
  selfie_url: string | null;
  traces: { place_name: string; difficulty: string } | null;
  users: { username: string } | null;
};

function formatTime(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const DIFF_COLOR: Record<string, string> = {
  easy: COLORS.green, medium: COLORS.amber,
  hard: COLORS.classified, legendary: COLORS.purple,
};

export default function FieldIntelScreen() {
  const { data: solves = [], isLoading } = useQuery({
    queryKey: ['field-intel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trace_solves')
        .select(`
          id, created_at, time_to_solve_seconds, selfie_url,
          traces ( place_name, difficulty ),
          users ( username )
        `)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as SolveFeedItem[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>FIELD INTEL</Text>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.amber} style={styles.loader} />
      ) : solves.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No activity yet.</Text>
          <Text style={styles.emptySub}>Solve traces to see the feed here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {solves.map((solve) => (
            <View key={solve.id} style={styles.card}>
              {solve.selfie_url && solve.selfie_url !== 'dev-placeholder' && (
                <Image source={{ uri: solve.selfie_url }} style={styles.selfie} />
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.diff, { color: DIFF_COLOR[solve.traces?.difficulty ?? 'easy'] }]}>
                    {solve.traces?.difficulty?.toUpperCase() ?? '—'}
                  </Text>
                  <Text style={styles.ago}>{timeAgo(solve.created_at)}</Text>
                </View>
                <Text style={styles.placeName} numberOfLines={1}>
                  {solve.traces?.place_name ?? 'Unknown trace'}
                </Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.username}>{solve.users?.username ?? 'tracer'}</Text>
                  <Text style={styles.time}>{formatTime(solve.time_to_solve_seconds)}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete, letterSpacing: 3 },
  headerTitle: { fontFamily: FONTS.uiExtraBold, fontSize: 26, color: COLORS.ghost, marginTop: 2 },
  loader: { marginTop: 48 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontFamily: FONTS.uiBold, fontSize: 16, color: COLORS.ghost },
  emptySub: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete, textAlign: 'center', letterSpacing: 0.5 },
  list: { paddingHorizontal: 20, paddingBottom: 48, gap: 10 },
  card: {
    backgroundColor: COLORS.navyMid, borderRadius: 8,
    overflow: 'hidden', flexDirection: 'row',
  },
  selfie: { width: 80, height: 80 },
  cardBody: {
    flex: 1, padding: 12, gap: 4, justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diff: { fontFamily: FONTS.monoBold, fontSize: 9, letterSpacing: 1.5 },
  ago: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete },
  placeName: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.ghost },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  username: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete },
  time: { fontFamily: FONTS.monoBold, fontSize: 12, color: COLORS.amber },
});
