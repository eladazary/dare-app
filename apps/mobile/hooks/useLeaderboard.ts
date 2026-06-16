import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';

type Difficulty = 'easy' | 'medium' | 'hard' | 'legend';
type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'community_review';

interface Submission {
  id: string;
  user_id: string;
  challenge_id: string;
  city_id: string;
  difficulty: Difficulty;
  photo_url: string;
  photo_thumb_url?: string;
  photo_taken_at: string;
  lat: number;
  lng: number;
  location_valid?: boolean;
  verification_status: VerificationStatus;
  vision_confidence?: number;
  ai_verdict?: string;
  votes_valid: number;
  votes_invalid: number;
  community_override?: boolean;
  base_points: number;
  bonus_points: number;
  total_points: number;
  speed_multiplier: number;
  streak_multiplier: number;
  weather_multiplier: number;
  city_rank?: number;
  caption?: string;
  submitted_at: string;
  users?: { username: string; streak_current: number; avatar_url?: string };
}

async function fetchLeaderboard(cityId: string, date: string): Promise<Submission[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_city_leaderboard', {
    p_city_id: cityId,
    p_date: date,
    p_limit: 50,
  });

  if (!rpcError && rpcData) {
    return rpcData as Submission[];
  }

  // RPC unavailable — query submissions directly.
  const { data, error } = await supabase
    .from('submissions')
    .select('*, users(username, streak_current, avatar_url)')
    .eq('city_id', cityId)
    .order('total_points', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  return (data ?? []) as Submission[];
}

export function useLeaderboard(cityId: string, date: string) {
  const userId = useUserStore((s) => s.user?.id);

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['leaderboard', cityId, date],
    queryFn: () => fetchLeaderboard(cityId, date),
    staleTime: 60 * 1000,
    enabled: Boolean(cityId && date),
  });

  const userRank = userId
    ? (rankings.findIndex((s: Submission) => s.user_id === userId) + 1 || null)
    : null;

  return { rankings, userRank, isLoading };
}
