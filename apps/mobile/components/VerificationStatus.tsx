import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '@/constants/colors';

type Status = 'pending' | 'approved' | 'rejected' | 'community_review';

type Props = {
  status: Status;
  confidence?: number;
};

type StatusConfig = {
  containerStyle: ViewStyle;
  label: string;
  textColor: string;
};

const STATUS_CONFIG: Record<Status, StatusConfig> = {
  pending: {
    containerStyle: {
      backgroundColor: COLORS.navyLight,
    },
    label: '⏳ Analysing proof...',
    textColor: COLORS.concrete,
  },
  approved: {
    containerStyle: {
      backgroundColor: 'rgba(46,204,138,0.15)',
      borderWidth: 1,
      borderColor: COLORS.green,
    },
    label: '✓ Proof confirmed',
    textColor: COLORS.green,
  },
  community_review: {
    containerStyle: {
      backgroundColor: 'rgba(245,166,35,0.15)',
      borderWidth: 1,
      borderColor: COLORS.amber,
    },
    label: '👥 Under review',
    textColor: COLORS.amber,
  },
  rejected: {
    containerStyle: {
      backgroundColor: 'rgba(255,59,92,0.15)',
      borderWidth: 1,
      borderColor: COLORS.red,
    },
    label: '✗ Proof rejected',
    textColor: COLORS.red,
  },
};

export default function VerificationStatus({ status }: Props) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, config.containerStyle]}>
      <Text style={[styles.text, { color: config.textColor }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
});
