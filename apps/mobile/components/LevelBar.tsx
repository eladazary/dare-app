import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

type Props = {
  level: string;
  xp: number;
  nextLevelXp: number;
  currentLevelXp: number;
};

export default function LevelBar({ level, xp, nextLevelXp, currentLevelXp }: Props) {
  const fraction = Math.min(
    1,
    Math.max(0, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp))
  );

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.level}>{level}</Text>
        <Text style={styles.xpText}>{xp} / {nextLevelXp} XP</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  level: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    color: COLORS.amber,
    textTransform: 'uppercase',
  },
  xpText: {
    fontSize: 12,
    color: COLORS.concrete,
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.navyLight,
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.amber,
  },
});
