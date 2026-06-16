import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

const MOCK_EXPEDITIONS = [
  {
    id: '1',
    clue: 'Someone left something at the place where the city starts its day. Look for what doesn\'t belong.',
    plantedBy: '@sunrise_walker',
    points: 200,
    expiresInHours: 4,
  },
  {
    id: '2',
    clue: 'A door that exists on no map. Ask someone old enough to remember.',
    plantedBy: '@old_town_ghost',
    points: 350,
    expiresInHours: 11,
  },
  {
    id: '3',
    clue: 'Find what the new city was built on top of.',
    plantedBy: '@memorykeeper',
    points: 500,
    expiresInHours: 2,
  },
];

const MOCK_TERRITORY = {
  locationCount: 23,
  dayCount: 14,
  photos: [
    { id: '1', rank: 'top3' },
    { id: '2', rank: 'top10' },
    { id: '3', rank: 'none' },
    { id: '4', rank: 'top3' },
    { id: '5', rank: 'top10' },
    { id: '6', rank: 'none' },
    { id: '7', rank: 'top10' },
    { id: '8', rank: 'none' },
    { id: '9', rank: 'top3' },
  ],
};

function rankDotColor(rank: string): string {
  if (rank === 'top3') return COLORS.amber;
  if (rank === 'top10') return COLORS.green;
  return COLORS.concrete;
}

export default function MapScreen() {
  const [activeTab, setActiveTab] = useState<'hunt' | 'territory'>('hunt');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>OPS</Text>
          <Text style={styles.headerTitle}>Field Ops</Text>
        </View>

        {/* Toggle Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('hunt')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'hunt' && styles.tabTextActive]}>
              HUNT
            </Text>
            {activeTab === 'hunt' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('territory')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'territory' && styles.tabTextActive]}>
              MY TERRITORY
            </Text>
            {activeTab === 'territory' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>

        {/* Hunt Tab */}
        {activeTab === 'hunt' && (
          <View>
            {MOCK_EXPEDITIONS.map((exp) => (
              <View key={exp.id} style={styles.expeditionCard}>
                {/* Top row */}
                <View style={styles.cardTopRow}>
                  <Text style={styles.expeditionLabel}>🚩 FIELD OP</Text>
                  <Text style={styles.expiresText}>Expires in {exp.expiresInHours}h</Text>
                </View>

                {/* Clue photo placeholder */}
                <View style={styles.cluePhoto}>
                  <Text style={styles.cluePhotoEmoji}>📍</Text>
                </View>

                {/* Clue text */}
                <Text style={styles.clueText} numberOfLines={2}>
                  {exp.clue}
                </Text>

                {/* Bottom row */}
                <View style={styles.cardBottomRow}>
                  <Text style={styles.plantedBy}>Op by {exp.plantedBy}</Text>
                  <Text style={styles.pointsBadge}>🏆 {exp.points} pts</Text>
                </View>

                {/* CTA button */}
                <TouchableOpacity style={styles.foundButton} activeOpacity={0.85}>
                  <Text style={styles.foundButtonText}>Mark as found →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* My Territory Tab */}
        {activeTab === 'territory' && (
          <View>
            {/* Territory stats header */}
            <View style={styles.territoryHeader}>
              <Text style={styles.locationCount}>
                {MOCK_TERRITORY.locationCount} locations dared
              </Text>
              <Text style={styles.dayCount}>across {MOCK_TERRITORY.dayCount} missions</Text>
            </View>

            {/* Photo grid */}
            <View style={styles.photoGrid}>
              {MOCK_TERRITORY.photos.map((photo) => (
                <View key={photo.id} style={styles.photoCell}>
                  <View style={styles.photoInner}>
                    <Text style={styles.photoEmoji}>📸</Text>
                    <View
                      style={[
                        styles.rankDot,
                        { backgroundColor: rankDotColor(photo.rank) },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Plant flag CTA */}
            <TouchableOpacity style={styles.plantButton} activeOpacity={0.85}>
              <Text style={styles.plantButtonText}>Plant a field op →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  headerLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 24,
    color: COLORS.ghost,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 24,
  },
  tab: {
    paddingBottom: 6,
    position: 'relative',
  },
  tabText: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.concrete,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: COLORS.amber,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.amber,
    borderRadius: 1,
  },
  expeditionCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expeditionLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  expiresText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.concrete,
  },
  cluePhoto: {
    backgroundColor: COLORS.navyLight,
    height: 120,
    borderRadius: 8,
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cluePhotoEmoji: {
    fontSize: 32,
  },
  clueText: {
    fontFamily: FONTS.challengeItalic,
    fontSize: 13,
    color: COLORS.ghost,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  plantedBy: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  pointsBadge: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    color: COLORS.amber,
  },
  foundButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  foundButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 14,
    color: COLORS.navy,
  },
  territoryHeader: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  locationCount: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.ghost,
  },
  dayCount: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
    marginTop: 2,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    gap: 6,
    marginBottom: 20,
  },
  photoCell: {
    width: '31.5%',
    aspectRatio: 1,
  },
  photoInner: {
    flex: 1,
    backgroundColor: COLORS.navyLight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoEmoji: {
    fontSize: 28,
  },
  rankDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  plantButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  plantButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },
});
