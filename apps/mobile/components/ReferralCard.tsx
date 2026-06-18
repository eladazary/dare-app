import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

export default function ReferralCard() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('users')
        .select('referral_code, invite_count')
        .eq('auth_id', user.id)
        .single();
      setCode(data?.referral_code ?? null);
      setLoading(false);
    };
    load();
  }, []);

  const handleShare = () => {
    if (!code) return;
    Share.share({
      message: `Join me on Tracer — the city exploration game.\nUse my code ${code} when you sign up and we both get bonus traces.\n\nruntracer.app`,
      title: 'Join Tracer',
    });
  };

  if (loading) return <ActivityIndicator color={COLORS.amber} style={{ margin: 20 }} />;
  if (!code) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>YOUR INVITE CODE</Text>
      <Text style={styles.code}>{code}</Text>
      <View style={styles.rewardRow}>
        <View style={styles.rewardItem}>
          <Text style={styles.rewardValue}>+500</Text>
          <Text style={styles.rewardLabel}>XP EACH</Text>
        </View>
        <View style={styles.rewardDivider} />
        <View style={styles.rewardItem}>
          <Text style={styles.rewardValue}>🤝 1</Text>
          <Text style={styles.rewardLabel}>FREE RESCUE</Text>
        </View>
      </View>
      <Text style={styles.sub}>
        Share your code — both of you get rewarded the moment they sign up.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={handleShare}>
        <Text style={styles.btnText}>↗ Share invite link</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyMid, borderRadius: 12,
    padding: 20, marginHorizontal: 20, marginTop: 16,
    borderWidth: 1, borderColor: COLORS.amber,
    alignItems: 'center', gap: 10,
  },
  label: {
    fontFamily: FONTS.mono, fontSize: 9,
    color: COLORS.concrete, letterSpacing: 3,
  },
  code: {
    fontFamily: FONTS.uiExtraBold, fontSize: 32,
    color: COLORS.amber, letterSpacing: 6,
  },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.navy, borderRadius: 10,
    padding: 14, gap: 16, width: '100%',
  },
  rewardItem: { flex: 1, alignItems: 'center', gap: 2 },
  rewardValue: {
    fontFamily: FONTS.uiExtraBold, fontSize: 22, color: COLORS.amber,
  },
  rewardLabel: {
    fontFamily: FONTS.mono, fontSize: 8,
    color: COLORS.concrete, letterSpacing: 2,
  },
  rewardDivider: {
    width: 1, height: 32, backgroundColor: COLORS.navyLight,
  },
  sub: {
    fontFamily: FONTS.mono, fontSize: 11,
    color: COLORS.concrete, textAlign: 'center',
    lineHeight: 18, letterSpacing: 0.3,
  },
  btn: {
    backgroundColor: COLORS.amber, borderRadius: 8,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 13, color: COLORS.navy },
});
