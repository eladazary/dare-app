import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

type Props = {
  totalSeconds: number;
  remainingSeconds: number;
  onExpire?: () => void;
};

export default function Timer({ totalSeconds, remainingSeconds, onExpire }: Props) {
  const [internalSeconds, setInternalSeconds] = useState(remainingSeconds);

  useEffect(() => {
    if (internalSeconds <= 0) {
      onExpire?.();
      return;
    }
    const interval = setInterval(() => {
      setInternalSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onExpire?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const ratio = internalSeconds / totalSeconds;
  const timeColor =
    ratio > 0.5 ? COLORS.green : ratio >= 0.2 ? COLORS.amber : COLORS.red;

  const minutes = Math.floor(internalSeconds / 60).toString().padStart(2, '0');
  const seconds = (internalSeconds % 60).toString().padStart(2, '0');
  const formatted = `${minutes}:${seconds}`;

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>MISSION CLOCK</Text>
        <Text style={[styles.time, { color: timeColor }]}>{formatted}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${internalSeconds / totalSeconds * 100}%`,
              backgroundColor: timeColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: COLORS.concrete,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  time: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.navyLight,
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});
