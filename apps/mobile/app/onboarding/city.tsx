import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type Arena = {
  id: string;
  name: string;
  country: string;
};

const GLOBAL_ID = '__global__';

export default function ArenaScreen() {
  const router = useRouter();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [privateCode, setPrivateCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);

  useEffect(() => {
    supabase
      .from('cities')
      .select('id,name,country')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setArenas(data);
        setLoading(false);
      });
  }, []);

  const select = (id: string) => {
    setSelectedId(id);
    setPrivateCode('');
  };

  const handleContinue = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (privateCode.trim()) {
      await supabase.from('users').update({ arena_code: privateCode.trim() }).eq('id', user.id);
    } else if (selectedId === GLOBAL_ID) {
      await supabase.from('users').update({ city_id: null }).eq('id', user.id);
    } else if (selectedId) {
      await supabase.from('users').update({ city_id: selectedId }).eq('id', user.id);
    }

    router.replace('/(tabs)');
  };

  const hasSelection = !!selectedId || privateCode.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Choose your arena.</Text>
        <Text style={styles.sub}>Compete globally or find your crew.</Text>

        <TouchableOpacity
          style={[styles.globalCard, selectedId === GLOBAL_ID && styles.selected]}
          onPress={() => select(GLOBAL_ID)}
        >
          <Text style={styles.globalIcon}>🌍</Text>
          <View style={styles.globalText}>
            <Text style={styles.globalTitle}>The World</Text>
            <Text style={styles.globalSub}>Dare against everyone, everywhere</Text>
          </View>
          {selectedId === GLOBAL_ID && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>PUBLIC ARENAS</Text>

        {loading ? (
          <ActivityIndicator color={COLORS.amber} style={styles.loader} />
        ) : (
          arenas.map((arena) => (
            <TouchableOpacity
              key={arena.id}
              style={[styles.arenaItem, selectedId === arena.id && styles.selected]}
              onPress={() => select(arena.id)}
            >
              <View>
                <Text style={styles.arenaName}>{arena.name}</Text>
                <Text style={styles.arenaSub}>{arena.country}</Text>
              </View>
              {selectedId === arena.id && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionLabel}>PRIVATE ARENA</Text>
        <TextInput
          style={[styles.codeInput, codeFocused && styles.codeInputFocused]}
          placeholder="Enter invite code"
          placeholderTextColor={COLORS.concrete}
          value={privateCode}
          onChangeText={(t) => { setPrivateCode(t); setSelectedId(null); }}
          onFocus={() => setCodeFocused(true)}
          onBlur={() => setCodeFocused(false)}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.continueButton, !hasSelection && styles.continueDisabled]}
          onPress={handleContinue}
          disabled={!hasSelection}
        >
          <Text style={styles.continueButtonText}>Begin your mission →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  heading: {
    color: COLORS.ghost,
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 6,
  },
  sub: {
    color: COLORS.concrete,
    fontSize: 14,
    marginBottom: 32,
  },
  globalCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  globalIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  globalText: {
    flex: 1,
  },
  globalTitle: {
    color: COLORS.ghost,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  globalSub: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    color: COLORS.concrete,
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  arenaItem: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selected: {
    borderColor: COLORS.amber,
  },
  arenaName: {
    color: COLORS.ghost,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  arenaSub: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: COLORS.amber,
    fontSize: 18,
  },
  loader: {
    marginTop: 16,
    marginBottom: 16,
  },
  codeInput: {
    color: COLORS.ghost,
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    letterSpacing: 2,
    marginTop: 0,
  },
  codeInputFocused: {
    borderColor: COLORS.amber,
  },
  continueButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  continueDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: COLORS.navy,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
});
