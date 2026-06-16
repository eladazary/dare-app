import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

type City = {
  id: string;
  name: string;
  country: string;
};

export default function CityScreen() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase
        .from('cities')
        .select('id,name,country')
        .eq('active', true)
        .order('name');
      if (data) setCities(data);
      setLoading(false);
    };
    fetchCities();
  }, []);

  const handleContinue = async () => {
    if (!selectedCityId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ city_id: selectedCityId }).eq('id', user.id);
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Pick your city.</Text>

        {loading ? (
          <ActivityIndicator color={COLORS.amber} />
        ) : (
          cities.map((city) => (
            <TouchableOpacity
              key={city.id}
              style={[
                styles.cityItem,
                { borderColor: selectedCityId === city.id ? COLORS.amber : 'transparent' },
              ]}
              onPress={() => setSelectedCityId(city.id)}
            >
              <View>
                <Text style={styles.cityName}>{city.name}</Text>
                <Text style={styles.cityCountry}>{city.country}</Text>
              </View>
              {selectedCityId === city.id && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[styles.continueButton, { opacity: selectedCityId ? 1 : 0.4 }]}
          onPress={handleContinue}
          disabled={!selectedCityId}
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
  },
  heading: {
    color: COLORS.ghost,
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 32,
  },
  cityItem: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityName: {
    color: COLORS.ghost,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  cityCountry: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: COLORS.amber,
    fontSize: 18,
  },
  continueButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  continueButtonText: {
    color: COLORS.navy,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
});
