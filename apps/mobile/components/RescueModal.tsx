import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { supabase } from '@/lib/supabase';

export interface RescueRequest {
  rescueId: string;
  traceId: string;
  traceName: string;
  friendUsername: string;
  hint: string;
}

interface Props {
  rescue: RescueRequest | null;
  onClose: () => void;
}

export default function RescueModal({ rescue, onClose }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!rescue) return null;

  const handleSend = async () => {
    setSending(true);
    // Update rescue record as sent + notify rescued user
    await supabase
      .from('trace_rescues')
      .update({ hint: rescue.hint })
      .eq('id', rescue.rescueId);

    // Get rescued user's ID to send notification
    const { data: rescueRecord } = await supabase
      .from('trace_rescues')
      .select('rescued_id')
      .eq('id', rescue.rescueId)
      .single();

    if (rescueRecord?.rescued_id) {
      await supabase.functions.invoke('send-notifications', {
        body: {
          type: 'rescue_needed',
          user_ids: [rescueRecord.rescued_id],
          data: {
            friend_name: 'A friend',
            hint: rescue.hint,
            rescue_id: rescue.rescueId,
          },
        },
      });
    }

    setSending(false);
    setSent(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerLabel}>RESCUE REQUEST</Text>
              <Text style={styles.headerTitle}>
                {rescue.friendUsername} needs help
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.context}>
            They're on their last attempt for this trace.
            Send them the hint — if they find it,{' '}
            <Text style={styles.contextBold}>your streak continues.</Text>
          </Text>

          <View style={styles.traceBox}>
            <Text style={styles.traceLabel}>TRACE</Text>
            <Text style={styles.traceName}>{rescue.traceName}</Text>
          </View>

          <View style={styles.hintBox}>
            <Text style={styles.hintLabel}>HINT TO SEND</Text>
            <Text style={styles.hintText}>{rescue.hint}</Text>
          </View>

          {sent ? (
            <View style={styles.sentBadge}>
              <Text style={styles.sentText}>✓ Hint sent — now it's on them.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color={COLORS.ghost} size="small" />
                : <Text style={styles.sendBtnText}>Send rescue hint →</Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.skipText}>
              {sent ? 'Done' : 'Skip — break my streak'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyMid,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLabel: {
    fontFamily: FONTS.mono, fontSize: 9,
    color: COLORS.green, letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: FONTS.uiExtraBold, fontSize: 20,
    color: COLORS.ghost, marginTop: 4,
  },
  closeBtn: { color: COLORS.concrete, fontSize: 18, padding: 4 },
  context: {
    fontFamily: FONTS.ui, fontSize: 13,
    color: COLORS.concrete, lineHeight: 20,
  },
  contextBold: {
    fontFamily: FONTS.uiBold, color: COLORS.amber,
  },
  traceBox: {
    backgroundColor: COLORS.navy, borderRadius: 8,
    padding: 14, borderLeftWidth: 3, borderLeftColor: COLORS.classified,
  },
  traceLabel: {
    fontFamily: FONTS.mono, fontSize: 8,
    color: COLORS.concrete, letterSpacing: 2, marginBottom: 4,
  },
  traceName: {
    fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.ghost,
  },
  hintBox: {
    backgroundColor: COLORS.navy, borderRadius: 8,
    padding: 14, borderLeftWidth: 3, borderLeftColor: COLORS.amber,
  },
  hintLabel: {
    fontFamily: FONTS.mono, fontSize: 8,
    color: COLORS.concrete, letterSpacing: 2, marginBottom: 4,
  },
  hintText: {
    fontFamily: FONTS.challengeItalic, fontSize: 15,
    color: COLORS.ghost, lineHeight: 22,
  },
  sendBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  sendBtnText: {
    fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.navy,
  },
  sentBadge: {
    borderWidth: 1, borderColor: COLORS.green,
    borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  sentText: {
    fontFamily: FONTS.monoBold, fontSize: 13,
    color: COLORS.green, letterSpacing: 1,
  },
  skipText: {
    fontFamily: FONTS.mono, fontSize: 11,
    color: COLORS.concrete, textAlign: 'center', letterSpacing: 0.5,
  },
});
