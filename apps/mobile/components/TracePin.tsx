import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

export type PinState = 'undiscovered' | 'active' | 'solved' | 'ghost';

interface TracePinProps {
  state?: PinState;
  distanceMeters?: number;
  onPress?: () => void;
}

const PIN_COLOR: Record<PinState, string> = {
  undiscovered: COLORS.amber,
  active: COLORS.classified,
  solved: COLORS.green,
  ghost: COLORS.concrete,
};

export default function TracePin({
  state = 'undiscovered',
  distanceMeters,
  onPress,
}: TracePinProps) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0.6)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (state === 'solved') return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse1, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity1, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse1, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity1, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );

    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(pulse2, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity2, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse2, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity2, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );

    loop.start();
    loop2.start();
    return () => { loop.stop(); loop2.stop(); };
  }, [state]);

  const color = PIN_COLOR[state];
  const isGhost = state === 'ghost';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      {/* Outer pulse rings */}
      {!isGhost && (
        <>
          <Animated.View
            style={[
              styles.ring,
              { borderColor: color, opacity: pulseOpacity1, transform: [{ scale: pulse1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              { borderColor: color, opacity: pulseOpacity2, transform: [{ scale: pulse2 }] },
            ]}
          />
        </>
      )}

      {/* Core pin */}
      <View style={[styles.pin, { backgroundColor: isGhost ? 'transparent' : color, borderColor: color }]}>
        {isGhost ? (
          <Text style={[styles.ghostIcon, { color }]}>?</Text>
        ) : state === 'solved' ? (
          <Text style={styles.solvedIcon}>✓</Text>
        ) : (
          <View style={styles.innerDot} />
        )}
      </View>

      {/* Distance label */}
      {distanceMeters != null && state !== 'solved' && (
        <View style={styles.distanceBadge}>
          <Text style={[styles.distanceText, { color }]}>
            {distanceMeters < 1000
              ? `${Math.round(distanceMeters)}m`
              : `${(distanceMeters / 1000).toFixed(1)}km`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const RING_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.navy,
  },
  ghostIcon: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  solvedIcon: {
    fontSize: 11,
    color: COLORS.navy,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: -18,
    backgroundColor: COLORS.navyMid,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  distanceText: {
    fontFamily: FONTS.monoBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
