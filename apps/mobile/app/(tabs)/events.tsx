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

const MOCK_DUEL = {
  myUsername: '@wanderer47',
  opponentUsername: '@city_hawk',
  opponentSubmitted: true,
  votesMe: 34,
  votesOpponent: 21,
  totalVotes: 55,
  voteEndsMinutes: 12,
  voteEndsSeconds: 44,
};

const MOCK_CHAMPIONSHIP = {
  myCity: 'TEL AVIV',
  myCityScore: 2450,
  challengerCity: 'LONDON',
  challengerCityScore: 2180,
  playerCount: 142,
  endsHours: 14,
  endsMinutes: 32,
};

const MOCK_UPCOMING = {
  registrantCount: 47,
};

const MOCK_RESULTS = {
  winnerCity: 'Tel Aviv',
  winnerScore: 3420,
  loserScore: 2890,
  myRank: 12,
  totalPlayers: 47,
  myXp: 350,
  winners: [
    { username: '@dawnchaser', medal: '🥇' },
    { username: '@rooftop_raj', medal: '🥈' },
    { username: '@lensflare_t', medal: '🥉' },
  ],
  myWins: 3,
  myLosses: 1,
};

export default function EventsScreen() {
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'debrief'>('live');

  const myVotePct =
    MOCK_DUEL.totalVotes > 0
      ? (MOCK_DUEL.votesMe / MOCK_DUEL.totalVotes) * 100
      : 50;

  const myChampionPct =
    MOCK_CHAMPIONSHIP.myCityScore + MOCK_CHAMPIONSHIP.challengerCityScore > 0
      ? (MOCK_CHAMPIONSHIP.myCityScore /
          (MOCK_CHAMPIONSHIP.myCityScore + MOCK_CHAMPIONSHIP.challengerCityScore)) *
        100
      : 50;

  const cityDiff = MOCK_CHAMPIONSHIP.myCityScore - MOCK_CHAMPIONSHIP.challengerCityScore;
  const cityWinning = cityDiff > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>ARENA</Text>
          <Text style={styles.headerTitle}>Arena</Text>
        </View>

        {/* Section Tabs */}
        <View style={styles.tabs}>
          {(['live', 'upcoming', 'debrief'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(tab as 'live' | 'upcoming' | 'debrief')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
              </Text>
              {activeTab === tab && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LIVE ── */}
        {activeTab === 'live' && (
          <View>
            {/* Active Duel Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>⚔️ HEAD TO HEAD</Text>

              <View style={styles.duelRow}>
                <View style={styles.duelSide}>
                  <View style={styles.duelPhoto}>
                    <Text style={styles.duelPhotoEmoji}>📸</Text>
                  </View>
                  <Text style={styles.duelUsername}>{MOCK_DUEL.myUsername}</Text>
                </View>

                <Text style={styles.vsText}>VS</Text>

                <View style={styles.duelSide}>
                  <View style={styles.duelPhoto}>
                    <Text style={styles.duelPhotoEmoji}>
                      {MOCK_DUEL.opponentSubmitted ? '📸' : '⏳ Waiting'}
                    </Text>
                  </View>
                  <Text style={styles.duelUsername}>{MOCK_DUEL.opponentUsername}</Text>
                </View>
              </View>

              {/* Vote bar */}
              <View style={styles.voteBarOuter}>
                <View style={[styles.voteBarAmber, { width: `${myVotePct}%` as any }]} />
                <View style={[styles.voteBarRed, { width: `${100 - myVotePct}%` as any }]} />
              </View>
              <Text style={styles.voteCount}>
                {MOCK_DUEL.votesMe} votes for you · {MOCK_DUEL.votesOpponent} votes for them
              </Text>
              <Text style={styles.voteEnds}>
                Vote ends in {MOCK_DUEL.voteEndsMinutes}m {MOCK_DUEL.voteEndsSeconds}s
              </Text>
            </View>

            {/* City Championship Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>🏙️ CITY WAR</Text>

              <View style={styles.championshipScoreRow}>
                <View style={styles.championshipSide}>
                  <Text style={styles.championshipCityName}>{MOCK_CHAMPIONSHIP.myCity}</Text>
                  <Text style={styles.championshipScore}>
                    {MOCK_CHAMPIONSHIP.myCityScore.toLocaleString()}
                  </Text>
                </View>

                <Text style={styles.vsText}>VS</Text>

                <View style={[styles.championshipSide, styles.alignRight]}>
                  <Text style={[styles.championshipCityName, styles.alignRight]}>
                    {MOCK_CHAMPIONSHIP.challengerCity}
                  </Text>
                  <Text style={[styles.championshipScore, styles.alignRight]}>
                    {MOCK_CHAMPIONSHIP.challengerCityScore.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.voteBarOuter}>
                <View style={[styles.voteBarAmber, { width: `${myChampionPct}%` as any }]} />
                <View style={[styles.voteBarRed, { width: `${100 - myChampionPct}%` as any }]} />
              </View>

              <Text style={[styles.cityStatus, { color: cityWinning ? COLORS.green : COLORS.red }]}>
                {cityWinning
                  ? `Your city is ahead by ${cityDiff} points`
                  : `Your city is losing by ${Math.abs(cityDiff)} points`}
              </Text>
              <Text style={styles.championshipMeta}>{MOCK_CHAMPIONSHIP.playerCount} players active</Text>
              <Text style={styles.championshipMeta}>
                Ends in {MOCK_CHAMPIONSHIP.endsHours}h {MOCK_CHAMPIONSHIP.endsMinutes}m
              </Text>
            </View>
          </View>
        )}

        {/* ── UPCOMING ── */}
        {activeTab === 'upcoming' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>🏆 WEEKEND CITY WAR</Text>
              <Text style={styles.tournamentName}>Weekend City War — Tel Aviv vs London</Text>
              <Text style={styles.tournamentDate}>Saturday 10:00am → Sunday midnight</Text>
              <Text style={styles.tournamentMeta}>{MOCK_UPCOMING.registrantCount} agents enlisted</Text>
              <Text style={styles.tournamentPrize}>
                Winner: Critical dare badge + 2000 XP + Legend status
              </Text>
              <TouchableOpacity style={styles.amberButton} activeOpacity={0.85}>
                <Text style={styles.amberButtonText}>Enlist →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.legendaryCard}>
              <Text style={styles.legendaryLabel}>⚡ CRITICAL DARE</Text>
              <Text style={styles.legendaryTitle}>Coming in 3 days</Text>
              <Text style={styles.legendarySubtitle}>30 minutes. No warning. Be ready.</Text>
              <Text style={styles.legendaryNote}>You'll get a notification</Text>
            </View>
          </View>
        )}

        {/* ── DEBRIEF ── */}
        {activeTab === 'debrief' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>LAST DEBRIEF</Text>
              <Text style={styles.resultWinner}>{MOCK_RESULTS.winnerCity} won the war 🏆</Text>
              <Text style={styles.resultScore}>
                Final score: {MOCK_RESULTS.winnerScore.toLocaleString()} vs{' '}
                {MOCK_RESULTS.loserScore.toLocaleString()}
              </Text>
              <Text style={styles.resultMine}>
                #{MOCK_RESULTS.myRank} of {MOCK_RESULTS.totalPlayers} · +{MOCK_RESULTS.myXp} XP earned
              </Text>

              <View style={styles.podium}>
                {MOCK_RESULTS.winners.map((w) => (
                  <View key={w.username} style={styles.podiumEntry}>
                    <View style={styles.podiumAvatar}>
                      <Text style={styles.podiumMedal}>{w.medal}</Text>
                    </View>
                    <Text style={styles.podiumName}>{w.username}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>⚔️ LAST WEEK'S DUELS</Text>
              <Text style={styles.duelRecord}>
                Your record: {MOCK_RESULTS.myWins}W / {MOCK_RESULTS.myLosses}L
              </Text>
            </View>
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
    gap: 20,
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
  card: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    gap: 10,
  },
  cardLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Duel
  duelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  duelSide: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  duelPhoto: {
    height: 100,
    width: '100%',
    backgroundColor: COLORS.navyLight,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duelPhotoEmoji: {
    fontSize: 28,
    textAlign: 'center',
  },
  duelUsername: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  vsText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 12,
    color: COLORS.ghost,
  },
  voteBarOuter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.concrete,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  voteBarAmber: {
    height: 6,
    backgroundColor: COLORS.amber,
  },
  voteBarRed: {
    height: 6,
    backgroundColor: COLORS.red,
  },
  voteCount: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
    textAlign: 'center',
  },
  voteEnds: {
    fontFamily: FONTS.uiBold,
    fontSize: 11,
    color: COLORS.red,
    textAlign: 'center',
  },
  // Championship
  championshipScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  championshipSide: {
    flex: 1,
    gap: 2,
  },
  championshipCityName: {
    fontFamily: FONTS.uiBold,
    fontSize: 11,
    color: COLORS.concrete,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  championshipScore: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20,
    color: COLORS.ghost,
  },
  alignRight: {
    textAlign: 'right',
    alignItems: 'flex-end',
  },
  cityStatus: {
    fontFamily: FONTS.uiBold,
    fontSize: 12,
    textAlign: 'center',
  },
  championshipMeta: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
    textAlign: 'center',
  },
  // Upcoming
  tournamentName: {
    fontFamily: FONTS.uiBold,
    fontSize: 18,
    color: COLORS.ghost,
    lineHeight: 24,
  },
  tournamentDate: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
  },
  tournamentMeta: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.concrete,
  },
  tournamentPrize: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
    color: COLORS.amber,
  },
  amberButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  amberButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },
  legendaryCard: {
    backgroundColor: COLORS.navyLight,
    borderWidth: 1,
    borderColor: COLORS.purple,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    gap: 6,
  },
  legendaryLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  legendaryTitle: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 16,
    color: COLORS.ghost,
  },
  legendarySubtitle: {
    fontFamily: FONTS.challengeItalic,
    fontSize: 13,
    color: COLORS.concrete,
  },
  legendaryNote: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.concrete,
  },
  // Results
  resultWinner: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20,
    color: COLORS.ghost,
  },
  resultScore: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
  },
  resultMine: {
    fontFamily: FONTS.uiBold,
    fontSize: 13,
    color: COLORS.amber,
  },
  podium: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  podiumEntry: {
    alignItems: 'center',
    gap: 4,
  },
  podiumAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumMedal: {
    fontSize: 20,
  },
  podiumName: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.concrete,
  },
  duelRecord: {
    fontFamily: FONTS.uiBold,
    fontSize: 16,
    color: COLORS.ghost,
  },
});
