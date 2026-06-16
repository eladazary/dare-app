import React, { useEffect } from 'react';
import { Modal, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';

interface Props {
  challenge: {
    archetype: string;
    easy: { title: string; hint: string };
    medium: { title: string; hint: string };
    hard: { title: string; hint: string };
    date: string;
  };
  onAccept: () => void;
  onClose: () => void;
}

const ARCHETYPE_EMOJI: Record<string, string> = {
  detective: '🔍',
  sprint: '⚡',
  hyperlocal: '📍',
  narrative: '📖',
  social: '👥',
  detail: '🔎',
  condition_lock: '🔒',
};

export default function PolaroidReveal({ challenge, onAccept, onClose }: Props) {
  const overlayOpacity = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const photoOpacity = useSharedValue(0);
  const photoDevelopProgress = useSharedValue(0);
  const emojiOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 300 });
    labelOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    cardScale.value = withDelay(600, withSpring(1, { damping: 18, stiffness: 150 }));
    photoOpacity.value = withDelay(900, withTiming(1, { duration: 1200 }));
    photoDevelopProgress.value = withDelay(900, withTiming(1, { duration: 1200 }));
    emojiOpacity.value = withDelay(1200, withTiming(1, { duration: 300 }));
    titleOpacity.value = withDelay(1600, withTiming(1, { duration: 300 }));
    buttonOpacity.value = withDelay(2200, withTiming(1, { duration: 300 }));
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { rotate: '-1.5deg' },
    ],
  }));

  const photoStyle = useAnimatedStyle(() => ({
    opacity: photoOpacity.value,
    backgroundColor: interpolateColor(
      photoDevelopProgress.value,
      [0, 1],
      ['#1a1a2e', '#3a4060']
    ),
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    opacity: emojiOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const emoji = ARCHETYPE_EMOJI[challenge.archetype] ?? '📸';

  return (
    <Modal transparent animationType="none">
      <View style={styles.backdrop}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlayFill, overlayStyle]} />

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <Animated.View style={labelStyle}>
          <Text style={styles.label}>TODAY'S DARE</Text>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.photo, photoStyle]}>
            <Animated.View style={[styles.emojiContainer, emojiStyle]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View style={titleStyle}>
            <Text style={styles.challengeTitle}>{challenge.medium.title}</Text>
            <Text style={styles.dateLabel}>DARE · {challenge.date}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={buttonStyle}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => {
              onAccept();
              onClose();
            }}
          >
            <Text style={styles.acceptText}>Accept the dare →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayFill: {
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 20,
  },
  closeText: {
    color: '#F0F4FF',
    fontSize: 20,
  },
  label: {
    color: '#8A9BB0',
    letterSpacing: 4,
    fontSize: 11,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    width: 280,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 48,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  photo: {
    width: 240,
    height: 200,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  challengeTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 17,
    color: '#1a1a2e',
    marginTop: 16,
  },
  dateLabel: {
    fontSize: 10,
    color: '#8A9BB0',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  acceptButton: {
    backgroundColor: '#F5A623',
    borderRadius: 50,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 32,
  },
  acceptText: {
    color: '#0A0E1A',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
