import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type NearbyTrace = {
  id: string;
  lat: number;
  lng: number;
  clue: string;
  place_name: string;
  reference_photo_url: string | null;
  photo_caption?: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  solve_radius_meters: number;
  notify_radius_meters: number;
  max_attempts: number;
  is_legendary: boolean;
  solve_count: number;
  distance_meters: number;
  already_solved: boolean;
  expires_at: string | null;
  xp_multiplier: number;
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

// publicUserId: undefined = not yet loaded (skip fetch), null = loaded but not found, string = ready
export function useNearbyTraces(location: UserLocation | null, publicUserId: string | null | undefined) {
  return useQuery({
    queryKey: ['nearby-traces', location?.lat.toFixed(3), location?.lng.toFixed(3), publicUserId ?? 'anon'],
    queryFn: async () => {
      if (!location) return [];
      const { data, error } = await supabase.rpc('get_nearby_traces', {
        user_lat: location.lat,
        user_lng: location.lng,
        user_id: publicUserId ?? null,
        radius_m: 2000,
      });
      if (error) throw error;
      return (data ?? []) as NearbyTrace[];
    },
    // Wait until publicUserId is known (undefined = still loading)
    enabled: !!location && publicUserId !== undefined,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export type GhostTrail = {
  id: string;
  trace_id: string;
  lat: number;
  lng: number;
};

export function useRevealedZones(userId: string | null) {
  return useQuery({
    queryKey: ['revealed-zones', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('revealed_zones')
        .select('cell_key')
        .eq('user_id', userId);
      return (data ?? []).map((r: any) => {
        const [lat, lng] = r.cell_key.split('_').map(Number);
        return { lat, lng };
      });
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useGhostTrails(location: UserLocation | null) {
  return useQuery({
    queryKey: ['ghost-trails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ghost_trails')
        .select('id, trace_id, approx_location')
        .gt('expires_at', new Date().toISOString())
        .limit(50);
      if (error) return [];
      return (data ?? []).map((g: any) => ({
        id: g.id,
        trace_id: g.trace_id,
        lat: g.approx_location?.coordinates?.[1] ?? 0,
        lng: g.approx_location?.coordinates?.[0] ?? 0,
      })) as GhostTrail[];
    },
    enabled: !!location,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });
}
