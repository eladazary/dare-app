import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { useFeedStore } from '@/stores/feedStore';

dayjs.extend(relativeTime);

const MOCK_SUBMISSIONS = Array.from({ length: 12 }, (_, i) => ({
  id: `mock-${i}`,
  user_id: `user-${i}`,
  challenge_id: 'ch-1',
  city_id: 'tel-aviv',
  difficulty: 'medium' as const,
  photo_url: '',
  photo_taken_at: new Date(Date.now() - i * 1000 * 60 * 15).toISOString(),
  lat: 32.08,
  lng: 34.78,
  verification_status: 'approved' as const,
  votes_valid: 12 - i,
  votes_invalid: i,
  base_points: 200,
  bonus_points: 50,
  total_points: 250,
  speed_multiplier: 1,
  streak_multiplier: 1,
  weather_multiplier: 1,
  city_rank: i + 1,
  caption: i % 3 === 0 ? 'Found it tucked behind the old market, exactly 4 steps up.' : undefined,
  submitted_at: new Date(Date.now() - i * 1000 * 60 * 15).toISOString(),
  users: {
    username: `wanderer${i + 1}`,
    streak_current: 20 - i,
  },
}));

interface Submission {
  id: string;
  user_id: string;
  challenge_id: string;
  city_id: string;
  difficulty: string;
  photo_url: string;
  photo_taken_at: string;
  lat: number;
  lng: number;
  verification_status: string;
  votes_valid: number;
  votes_invalid: number;
  base_points: number;
  bonus_points: number;
  total_points: number;
  speed_multiplier: number;
  streak_multiplier: number;
  weather_multiplier: number;
  city_rank?: number;
  caption?: string;
  submitted_at: string;
  users?: { username: string; streak_current: number; avatar_url?: string };
}

function FeedItem({ item }: { item: Submission }) {
  const [expanded, setExpanded] = useState(false);
  const [userVote, setUserVote] = useState<'valid' | 'invalid' | 'unsure' | null>(null);
  const height = useSharedValue(80);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const handlePress = useCallback(() => {
    const next = !expanded;
    height.value = withTiming(next ? 80 + 180 + 100 : 80, { duration: 250 });
    setExpanded(next);
  }, [expanded]);

  const rank = item.city_rank;
  const rankColor = rank === 1 ? COLORS.amber : COLORS.concrete;
  const timeAgo = dayjs(item.submitted_at).fromNow();

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.feedItem, expanded && styles.feedItemExpanded, animatedStyle]}>
        {/* Collapsed row */}
        <View style={styles.feedItemRow}>
          <View style={styles.thumbContainer}>
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbEmoji}>📸</Text>
            </View>
            {rank != null && (
              <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.rankText}>#{rank}</Text>
              </View>
            )}
            <View style={styles.voteCount}>
              <Text style={styles.voteCountText}>{item.votes_valid}</Text>
            </View>
          </View>
          <View style={styles.feedMeta}>
            <Text style={styles.feedUsername}>{item.users?.username ?? 'wanderer'}</Text>
            <Text style={styles.feedStreak}>🔥 {item.users?.streak_current ?? 0}</Text>
            <Text style={styles.feedTime}>{timeAgo}</Text>
          </View>
        </View>

        {/* Expanded content */}
        {expanded && (
          <View>
            <View style={styles.expandedPhoto}>
              <Text style={{ fontSize: 48 }}>📸</Text>
            </View>
            {item.caption ? (
              <Text style={styles.caption}>{item.caption}</Text>
            ) : null}
            <View style={styles.voteRow}>
              {([
                { key: 'valid', label: '✓ Legit', color: COLORS.green },
                { key: 'invalid', label: '✗ Fake', color: COLORS.red },
                { key: 'unsure', label: '? Unclear', color: COLORS.concrete },
              ] as { key: 'valid' | 'invalid' | 'unsure'; label: string; color: string }[]).map((v, idx) => (
                <TouchableOpacity
                  key={v.key}
                  style={[
                    styles.voteButton,
                    idx < 2 && styles.voteButtonBorder,
                    userVote === v.key && { backgroundColor: COLORS.navyLight },
                  ]}
                  onPress={() => setUserVote(v.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.voteLabel, { color: v.color }]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function CityScreen() {
  const { submissions, neighborhoodMode, toggleNeighborhoodMode } = useFeedStore();
  const data = submissions.length > 0 ? submissions : MOCK_SUBMISSIONS;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>TEL AVIV · LIVE INTEL</Text>
        <Text style={styles.headerTitle}>City Intel</Text>
      </View>

      <View style={styles.toggleRow}>
        {(['City', 'Within 1km'] as const).map((label) => {
          const active = label === 'City' ? !neighborhoodMode : neighborhoodMode;
          return (
            <TouchableOpacity
              key={label}
              style={[styles.togglePill, active && styles.togglePillActive]}
              onPress={toggleNeighborhoodMode}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlashList
        data={data as Submission[]}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        renderItem={({ item }) => <FeedItem item={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  headerSub: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 24,
    color: COLORS.ghost,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  togglePill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.navyLight,
  },
  togglePillActive: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  toggleText: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
    color: COLORS.concrete,
  },
  toggleTextActive: {
    color: COLORS.navy,
  },
  listContent: {
    paddingBottom: 24,
  },
  feedItem: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  feedItemExpanded: {
    borderColor: COLORS.amber,
  },
  feedItemRow: {
    flexDirection: 'row',
    height: 80,
  },
  thumbContainer: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  thumbPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: {
    fontSize: 28,
  },
  rankBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rankText: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.navy,
  },
  voteCount: {
    position: 'absolute',
    bottom: 5,
    right: 5,
  },
  voteCountText: {
    fontFamily: FONTS.uiBold,
    fontSize: 11,
    color: COLORS.ghost,
  },
  feedMeta: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 4,
  },
  feedUsername: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
  },
  feedStreak: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.amber,
  },
  feedTime: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  expandedPhoto: {
    height: 180,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontFamily: FONTS.challengeItalic,
    fontSize: 13,
    color: COLORS.concrete,
    lineHeight: 20,
    padding: 12,
  },
  voteRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.navy,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  voteButtonBorder: {
    borderRightWidth: 1,
    borderRightColor: COLORS.navy,
  },
  voteLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
  },
});
