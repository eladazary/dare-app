import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

interface Props {
  streak: number;
  shields: number;
}

export default function StreakCounter({ streak, shields }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.streakText}>🔥{streak}</Text>
      </View>
      {shields > 0 && (
        <Text style={styles.shields}>🛡️ ×{shields}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.amber,
  },
  shields: {
    fontSize: 12,
    color: COLORS.concrete,
  },
});
