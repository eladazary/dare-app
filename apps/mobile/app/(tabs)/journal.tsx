import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

type JournalEntry = {
  id: string;
  created_at: string;
  time_to_solve_seconds: number;
  selfie_url: string | null;
  traces: {
    place_name: string;
    difficulty: string;
    clue: string;
    fun_fact: string | null;
  } | null;
};

const DIFF_COLOR: Record<string, string> = {
  easy: COLORS.green, medium: COLORS.amber,
  hard: COLORS.classified, legendary: COLORS.purple,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function JournalScreen() {
  const { session } = useAuthStore();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    const load = async () => {
      const { data: u } = await supabase.from('users').select('id').eq('auth_id', session.user.id).single();
      if (!u) return;
      const { data } = await supabase
        .from('trace_solves')
        .select('id, created_at, time_to_solve_seconds, selfie_url, traces(place_name, difficulty, clue, fun_fact)')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false });
      setEntries((data ?? []) as JournalEntry[]);
      setLoading(false);
    };
    load();
  }, [session]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>FIELD JOURNAL</Text>
        <Text style={styles.headerTitle}>Your Traces</Text>
        {entries.length > 0 && <Text style={styles.headerCount}>{entries.length} found</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.amber} style={{ marginTop: 48 }} />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={styles.emptyText}>Your journal is empty.</Text>
          <Text style={styles.emptySub}>Start finding traces to fill it.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {entries.map((e) => (
            <TouchableOpacity key={e.id} style={styles.card} onPress={() => setSelected(e)}>
              {e.selfie_url && e.selfie_url !== 'dev-placeholder' ? (
                <Image source={{ uri: e.selfie_url }} style={styles.cardImg} />
              ) : (
                <View style={styles.cardImgPlaceholder}>
                  <Text style={styles.cardImgIcon}>📍</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={[styles.cardDiff, { color: DIFF_COLOR[e.traces?.difficulty ?? 'easy'] }]}>
                  {e.traces?.difficulty?.toUpperCase() ?? '—'}
                </Text>
                <Text style={styles.cardName} numberOfLines={2}>
                  {e.traces?.place_name ?? 'Unknown'}
                </Text>
                <Text style={styles.cardMeta}>
                  {formatDate(e.created_at)} · {formatTime(e.time_to_solve_seconds)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelected(null)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {selected.selfie_url && selected.selfie_url !== 'dev-placeholder' ? (
                  <Image source={{ uri: selected.selfie_url }} style={styles.modalImg} />
                ) : (
                  <View style={styles.modalImgPlaceholder}><Text style={{ fontSize: 48 }}>📍</Text></View>
                )}
                <View style={styles.modalBody}>
                  <Text style={[styles.modalDiff, { color: DIFF_COLOR[selected.traces?.difficulty ?? 'easy'] }]}>
                    {selected.traces?.difficulty?.toUpperCase()}
                  </Text>
                  <Text style={styles.modalName}>{selected.traces?.place_name}</Text>
                  <Text style={styles.modalMeta}>
                    Found {formatDate(selected.created_at)} in {formatTime(selected.time_to_solve_seconds)}
                  </Text>
                  {selected.traces?.fun_fact && (
                    <View style={styles.funFactBox}>
                      <Text style={styles.funFactLabel}>DID YOU KNOW</Text>
                      <Text style={styles.funFactText}>{selected.traces.fun_fact}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete, letterSpacing: 3 },
  headerTitle: { fontFamily: FONTS.uiExtraBold, fontSize: 26, color: COLORS.ghost, marginTop: 2 },
  headerCount: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.amber, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: FONTS.uiBold, fontSize: 16, color: COLORS.ghost },
  emptySub: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete },
  grid: {
    paddingHorizontal: 20, paddingBottom: 48,
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  card: {
    width: '47%', backgroundColor: COLORS.navyMid,
    borderRadius: 10, overflow: 'hidden',
  },
  cardImg: { width: '100%', aspectRatio: 1 },
  cardImgPlaceholder: {
    width: '100%', aspectRatio: 1, backgroundColor: COLORS.navyLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardImgIcon: { fontSize: 32 },
  cardBody: { padding: 10, gap: 3 },
  cardDiff: { fontFamily: FONTS.monoBold, fontSize: 8, letterSpacing: 1.5 },
  cardName: { fontFamily: FONTS.uiBold, fontSize: 13, color: COLORS.ghost, lineHeight: 17 },
  cardMeta: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.concrete },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.navyMid, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, maxHeight: '90%',
  },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  modalCloseText: { color: COLORS.concrete, fontSize: 18 },
  modalImg: { width: '100%', aspectRatio: 1.2 },
  modalImgPlaceholder: {
    width: '100%', aspectRatio: 1.2,
    backgroundColor: COLORS.navyLight, alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: 20, gap: 8 },
  modalDiff: { fontFamily: FONTS.monoBold, fontSize: 10, letterSpacing: 2 },
  modalName: { fontFamily: FONTS.uiExtraBold, fontSize: 20, color: COLORS.ghost },
  modalMeta: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete },
  funFactBox: {
    backgroundColor: COLORS.navy, borderRadius: 8,
    padding: 14, marginTop: 8, borderLeftWidth: 3, borderLeftColor: COLORS.amber,
    gap: 6,
  },
  funFactLabel: { fontFamily: FONTS.monoBold, fontSize: 8, color: COLORS.amber, letterSpacing: 2 },
  funFactText: { fontFamily: FONTS.challengeItalic, fontSize: 14, color: COLORS.ghost, lineHeight: 21 },
});
