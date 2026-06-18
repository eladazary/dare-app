import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  visible: boolean;
  traceId: string;
  traceName: string;
  onPurchased: () => void;   // called with 3 new attempts
  onClose: () => void;
}

export default function ExtraAttemptsModal({ visible, traceId, traceName, onPurchased, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    // TODO: gate behind RevenueCat payment before calling this RPC
    const { error } = await supabase.rpc('purchase_extra_attempts', {
      p_trace_id: traceId,
    });
    setLoading(false);
    if (!error) onPurchased();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>

          <Text style={styles.emoji}>🔴</Text>
          <Text style={styles.title}>Out of attempts</Text>
          <Text style={styles.traceName}>{traceName}</Text>
          <Text style={styles.sub}>
            Your streak is still alive.{'\n'}
            Get 3 more attempts to keep it going.
          </Text>

          <View style={styles.priceBox}>
            <Text style={styles.price}>$0.99</Text>
            <Text style={styles.priceLabel}>for 3 attempts</Text>
          </View>

          <TouchableOpacity
            style={styles.buyBtn}
            onPress={handlePurchase}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.navy} />
              : <Text style={styles.buyBtnText}>Buy 3 attempts →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.skipText}>Give up this trace</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyMid,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 28, paddingBottom: 48, alignItems: 'center', gap: 12,
  },
  emoji: { fontSize: 40 },
  title: {
    fontFamily: FONTS.uiExtraBold, fontSize: 22, color: COLORS.ghost,
  },
  traceName: {
    fontFamily: FONTS.challengeItalic, fontSize: 15,
    color: COLORS.concrete, textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete,
    textAlign: 'center', lineHeight: 20, letterSpacing: 0.3,
  },
  priceBox: {
    backgroundColor: COLORS.navy, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: COLORS.amber,
  },
  price: {
    fontFamily: FONTS.uiExtraBold, fontSize: 36, color: COLORS.amber,
  },
  priceLabel: {
    fontFamily: FONTS.mono, fontSize: 10,
    color: COLORS.concrete, letterSpacing: 2,
  },
  buyBtn: {
    backgroundColor: COLORS.amber, borderRadius: 50,
    paddingVertical: 15, paddingHorizontal: 40, width: '100%',
    alignItems: 'center', marginTop: 4,
  },
  buyBtnText: { fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.navy },
  skipText: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete,
    letterSpacing: 1, marginTop: 4,
  },
});
