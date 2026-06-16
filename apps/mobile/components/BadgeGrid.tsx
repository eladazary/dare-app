import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/constants/colors';

interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'legendary';
  earned: boolean;
}

interface Props {
  badges: Badge[];
}

export default function BadgeGrid({ badges }: Props) {
  const renderItem = ({ item }: { item: Badge }) => {
    const rarityDotColor =
      item.rarity === 'rare'
        ? COLORS.amber
        : item.rarity === 'legendary'
        ? COLORS.purple
        : null;

    return (
      <View style={[styles.card, { opacity: item.earned ? 1 : 0.35 }]}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            {rarityDotColor !== null && (
              <View style={[styles.rarityDot, { backgroundColor: rarityDotColor }]} />
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.badgeName}>{item.name}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={badges}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    padding: 12,
    margin: 4,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#252D45',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emoji: {
    fontSize: 28,
  },
  rarityDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textContainer: {
    marginLeft: 10,
    flex: 1,
  },
  badgeName: {
    color: COLORS.ghost,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  description: {
    color: COLORS.concrete,
    fontSize: 11,
    marginTop: 2,
  },
});
