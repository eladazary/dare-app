import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserLocation } from './useTraces';

const MIN_INTERVAL_MS = 30_000; // don't call more than once per 30s
const MIN_MOVE_METERS = 50;     // don't call unless user moved ≥50m

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fires a proximity check against the edge function whenever the user moves
// significantly. The edge function calls get_newly_entered_traces (which
// atomically logs the notification) then fires the Expo push.
export function useTraceProximityNotifier(
  location: UserLocation | null,
  publicUserId: string | null | undefined,
) {
  const lastLocationRef = useRef<UserLocation | null>(null);
  const lastCalledAtRef = useRef<number>(0);

  useEffect(() => {
    if (!location || !publicUserId) return;

    const now = Date.now();

    // Time gate
    if (now - lastCalledAtRef.current < MIN_INTERVAL_MS) return;

    // Distance gate
    const last = lastLocationRef.current;
    if (last && haversineMeters(last.lat, last.lng, location.lat, location.lng) < MIN_MOVE_METERS) {
      return;
    }

    lastLocationRef.current = location;
    lastCalledAtRef.current = now;

    // Fire-and-forget — the edge function handles push sending
    supabase.functions
      .invoke('trace-nearby', {
        body: { user_id: publicUserId, lat: location.lat, lng: location.lng },
      })
      .catch(() => {});
  }, [location, publicUserId]);
}
