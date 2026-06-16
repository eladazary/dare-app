import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 20;
const GRID_GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

interface MockSubmission {
  id: string;
  date: string;
  rank?: number;
  badge?: string;
}

const MOCK_SUBMISSIONS: MockSubmission[] = [
  { id: '1', date: 'Jun 16', rank: 1, badge: '⚡' },
  { id: '2', date: 'Jun 15', rank: 3 },
  { id: '3', date: 'Jun 14', rank: 2, badge: '🌅' },
  { id: '4', date: 'Jun 13', rank: 12 },
  { id: '5', date: 'Jun 12', rank: 1, badge: '🔥' },
  { id: '6', date: 'Jun 11', rank: 7 },
  { id: '7', date: 'Jun 10', rank: 4 },
  { id: '8', date: 'Jun 9', rank: 1 },
  { id: '9', date: 'Jun 8', rank: 22 },
  { id: '10', date: 'Jun 7', rank: 6, badge: '🌧️' },
  { id: '11', date: 'Jun 6', rank: 2 },
  { id: '12', date: 'Jun 5', rank: 11 },
];

const STATS = [
  { value: '3', label: 'Times ranked #1' },
  { value: '4,250', label: 'Total XP' },
  { value: '47', label: 'Best streak' },
  { value: '#8', label: 'City avg rank' },
];

function GridItem({ item }: { item: MockSubmission }) {
  const rankColor = item.rank === 1 ? COLORS.amber : COLORS.concrete;

  return (
    <View style={styles.gridItem}>
      <View style={styles.gridPhotoPlaceholder}>
        <Text style={{ fontSize: 28 }}>📸</Text>
      </View>
      <Text style={styles.gridDate}>{item.date}</Text>
      {item.rank != null && (
        <View style={[styles.gridRankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.gridRankText}>#{item.rank}</Text>
        </View>
      )}
      {item.badge && (
        <Text style={styles.gridBadge}>{item.badge}</Text>
      )}
    </View>
  );
}

export default function GalleryScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={MOCK_SUBMISSIONS}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerLabel}>AGENT FILE</Text>
              <Text style={styles.headerTitle}>Archive</Text>
              <Text style={styles.headerSub}>47 missions · 47 dares completed</Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {STATS.map((stat, idx) => (
                <View key={idx} style={styles.statCard}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Grid header */}
            <View style={styles.gridHeader} />
          </View>
        }
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <GridItem item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  listContent: {
    paddingBottom: 32,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  headerLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.concrete,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.ghost,
    marginTop: 2,
  },
  headerSub: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  statCard: {
    width: (SCREEN_WIDTH - 40 - 8) / 2,
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.amber,
  },
  statLabel: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    textAlign: 'center',
  },
  gridHeader: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  columnWrapper: {
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: COLORS.navyLight,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  gridPhotoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDate: {
    position: 'absolute',
    bottom: 4,
    left: 5,
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.concrete,
  },
  gridRankBadge: {
    position: 'absolute',
    bottom: 4,
    right: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gridRankText: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.navy,
  },
  gridBadge: {
    position: 'absolute',
    top: 4,
    right: 5,
    fontSize: 14,
  },
});
