import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { supabase } from '@/lib/supabase';

type Friend = {
  id: string;
  username: string;
  xp: number;
  streak_current: number;
};

interface Props {
  visible: boolean;
  traceId: string;
  traceName: string;
  solveTimeSeconds: number;
  onClose: () => void;
  onSent: (friendUsername: string) => void;
}

export default function TauntModal({ visible, traceId, traceName, solveTimeSeconds, onClose, onSent }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    loadFriends();
  }, [visible]);

  const loadFriends = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get users this person follows
    const { data } = await supabase
      .from('follows')
      .select('following_id, users!follows_following_id_fkey(id, username, xp, streak_current)')
      .eq('follower_id', (await supabase.from('users').select('id').eq('auth_id', user.id).single()).data?.id);

    if (data) {
      setFriends(data.map((f: any) => f.users).filter(Boolean));
    }
    setLoading(false);
  };

  const handleTaunt = async (friend: Friend) => {
    setSending(friend.id);
    const { error } = await supabase.rpc('send_taunt', {
      p_trace_id: traceId,
      p_challenged_user_id: friend.id,
      p_challenger_time_seconds: solveTimeSeconds,
    });
    setSending(null);
    if (!error) onSent(friend.username);
  };

  const filtered = friends.filter(f =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  function formatTime(s: number) {
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerLabel}>TAUNT</Text>
              <Text style={styles.headerTitle}>Challenge a friend</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Your benchmark */}
          <View style={styles.benchmark}>
            <Text style={styles.benchmarkLabel}>YOUR TIME TO BEAT</Text>
            <Text style={styles.benchmarkTime}>{formatTime(solveTimeSeconds)}</Text>
            <Text style={styles.benchmarkTrace} numberOfLines={1}>{traceName}</Text>
          </View>

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={COLORS.concrete}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />

          {/* Friends list */}
          {loading ? (
            <ActivityIndicator color={COLORS.amber} style={styles.loader} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {friends.length === 0
                  ? 'No friends yet.\nShare the app to challenge someone.'
                  : 'No friends match your search.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(f) => f.id}
              renderItem={({ item: friend }) => (
                <View style={styles.friendRow}>
                  <View style={styles.friendLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {friend.username[0].toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.friendName}>{friend.username}</Text>
                      <Text style={styles.friendStreak}>
                        🔥 {friend.streak_current} run
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.tauntBtn, sending === friend.id && styles.tauntBtnSending]}
                    onPress={() => handleTaunt(friend)}
                    disabled={!!sending}
                  >
                    {sending === friend.id
                      ? <ActivityIndicator color={COLORS.ghost} size="small" />
                      : <Text style={styles.tauntBtnText}>⚔ Taunt</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyMid,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.classified,
    letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20,
    color: COLORS.ghost,
    marginTop: 2,
  },
  closeBtn: {
    color: COLORS.concrete,
    fontSize: 18,
    padding: 4,
  },
  benchmark: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
  },
  benchmarkLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.concrete,
    letterSpacing: 2,
    marginBottom: 4,
  },
  benchmarkTime: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.amber,
  },
  benchmarkTrace: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.concrete,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  searchInput: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 40,
    color: COLORS.ghost,
    fontFamily: FONTS.ui,
    fontSize: 14,
    marginBottom: 12,
  },
  loader: {
    marginTop: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.concrete,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  list: {
    maxHeight: 320,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLight,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  avatarText: {
    fontFamily: FONTS.uiBold,
    fontSize: 16,
    color: COLORS.amber,
  },
  friendName: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
  },
  friendStreak: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.concrete,
    marginTop: 2,
  },
  tauntBtn: {
    backgroundColor: COLORS.classified,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  tauntBtnSending: {
    opacity: 0.6,
  },
  tauntBtnText: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: COLORS.ghost,
    letterSpacing: 1,
  },
});
