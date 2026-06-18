import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

export default function FieldIntelScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.label}>FIELD INTEL</Text>
        <Text style={styles.title}>Activity</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No activity yet.</Text>
        <Text style={styles.emptySubtext}>Solve traces to see your feed here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  label: {
    fontFamily: FONTS.mono, fontSize: 10,
    color: COLORS.concrete, letterSpacing: 3,
  },
  title: {
    fontFamily: FONTS.uiExtraBold, fontSize: 26,
    color: COLORS.ghost, marginTop: 2,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: {
    fontFamily: FONTS.uiBold, fontSize: 16, color: COLORS.ghost,
  },
  emptySubtext: {
    fontFamily: FONTS.mono, fontSize: 12,
    color: COLORS.concrete, letterSpacing: 0.5,
  },
});
