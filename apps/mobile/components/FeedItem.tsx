import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { COLORS } from '@/constants/colors';

dayjs.extend(relativeTime);

interface Props {
  submission: {
    id: string;
    users?: { username: string; streak_current: number };
    votes_valid: number;
    votes_invalid: number;
    city_rank?: number;
    caption?: string;
    submitted_at: string;
    photo_url?: string;
    photo_thumb_url?: string;
    verification_status: string;
  };
  onVote: (submissionId: string, vote: 'valid' | 'invalid' | 'unsure') => void;
}

export default function FeedItem({ submission, onVote }: Props) {
  const isExpanded = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(isExpanded.value ? 340 : 80, { duration: 250 }),
    borderColor: isExpanded.value ? COLORS.amber : 'transparent',
  }));

  const handlePress = () => {
    isExpanded.value = !isExpanded.value;
  };

  const rankIsFirst = submission.city_rank === 1;

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.collapsed}>
          <View style={styles.leftBox}>
            <Text style={styles.photoEmoji}>📸</Text>
            <View
              style={[
                styles.rankBadge,
                rankIsFirst
                  ? { backgroundColor: COLORS.amber }
                  : { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.navyLight },
              ]}
            >
              <Text
                style={[
                  styles.rankText,
                  { color: rankIsFirst ? COLORS.navy : COLORS.concrete },
                ]}
              >
                {submission.city_rank ? '#' + submission.city_rank.toString() : '?'}
              </Text>
            </View>
            <Text style={styles.voteCount}>{submission.votes_valid.toString()}</Text>
          </View>
          <View style={styles.rightSide}>
            <Text style={styles.username}>
              {submission.users?.username ?? 'Unknown'}
            </Text>
            <Text style={styles.streak}>
              {'🔥 ' + (submission.users?.streak_current ?? 0).toString()}
            </Text>
            <Text style={styles.timeAgo}>
              {dayjs(submission.submitted_at).fromNow()}
            </Text>
          </View>
        </View>

        <View style={styles.expanded}>
          <View style={styles.photoArea}>
            {submission.photo_url || submission.photo_thumb_url ? (
              <Image
                source={{ uri: submission.photo_thumb_url || submission.photo_url }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.photoPlaceholder}>📸</Text>
            )}
          </View>
          {submission.caption ? (
            <Text style={styles.caption}>{submission.caption}</Text>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.voteRow}>
            <TouchableOpacity
              style={[styles.voteButton, styles.voteButtonBorder]}
              onPress={() => onVote(submission.id, 'valid')}
            >
              <Text style={styles.voteValid}>✓ Valid</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteButton, styles.voteButtonBorder]}
              onPress={() => onVote(submission.id, 'invalid')}
            >
              <Text style={styles.voteInvalid}>✗ Invalid</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voteButton}
              onPress={() => onVote(submission.id, 'unsure')}
            >
              <Text style={styles.voteUnsure}>? Unsure</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: COLORS.navyMid,
    borderWidth: 1,
  },
  collapsed: {
    height: 80,
    flexDirection: 'row',
  },
  leftBox: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoEmoji: {
    fontSize: 28,
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  rankText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  voteCount: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    fontSize: 11,
    color: COLORS.green,
  },
  rightSide: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  username: {
    color: COLORS.ghost,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  streak: {
    color: COLORS.amber,
    fontSize: 12,
    marginTop: 2,
  },
  timeAgo: {
    color: COLORS.concrete,
    fontSize: 11,
    marginTop: 2,
  },
  expanded: {
    width: '100%',
  },
  photoArea: {
    height: 180,
    width: '100%',
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: 180,
  },
  photoPlaceholder: {
    fontSize: 48,
  },
  caption: {
    fontStyle: 'italic',
    color: COLORS.concrete,
    fontSize: 13,
    padding: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.navyLight,
    marginHorizontal: 12,
  },
  voteRow: {
    flexDirection: 'row',
    height: 48,
  },
  voteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteButtonBorder: {
    borderRightWidth: 1,
    borderRightColor: COLORS.navyLight,
  },
  voteValid: {
    color: COLORS.green,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  voteInvalid: {
    color: COLORS.red,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  voteUnsure: {
    color: COLORS.concrete,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
