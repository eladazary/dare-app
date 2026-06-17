import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type NearbyTrace = {
  id: string;
  lat: number;
  lng: number;
  clue: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  solve_radius_meters: number;
  notify_radius_meters: number;
  max_attempts: number;
  is_legendary: boolean;
  solve_count: number;
  distance_meters: number;
  already_solved: boolean;
};

export type UserLocation = {
  lat: number;
  lng: number;
};

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);

  const requestAndWatch = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission denied');
      return;
    }
    setGranted(true);

    // Get initial position fast
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });

    // Watch for updates
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    requestAndWatch().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, [requestAndWatch]);

  return { location, error, granted };
}

export function useNearbyTraces(location: UserLocation | null) {
  return useQuery({
    queryKey: ['nearby-traces', location?.lat.toFixed(3), location?.lng.toFixed(3)],
    queryFn: async () => {
      if (!location) return [];
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('get_nearby_traces', {
        user_lat: location.lat,
        user_lng: location.lng,
        user_id: user?.id ?? null,
        radius_m: 2000,
      });
      if (error) throw error;
      return (data ?? []) as NearbyTrace[];
    },
    enabled: !!location,
    refetchInterval: 30_000, // re-check every 30s
    staleTime: 20_000,
  });
}
