import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFeedStore } from '../stores/feedStore';

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

interface VoteRow {
  submission_id: string;
  vote_type: 'valid' | 'invalid';
}

export function useRealtimeFeed(challengeId: string, cityId: string) {
  const submissions = useFeedStore((s) => s.submissions);
  const appendSubmissions = useFeedStore((s) => s.appendSubmissions);
  const updateSubmission = useFeedStore((s) => s.updateSubmission);
  const updateVoteCount = useFeedStore((s) => s.updateVoteCount);

  useEffect(() => {
    if (!challengeId || !cityId) return;

    const channel = supabase
      .channel(`feed:${challengeId}:${cityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
          filter: `challenge_id=eq.${challengeId}`,
        },
        (payload) => {
          const newSubmission = payload.new as Submission;
          if (newSubmission.city_id === cityId) {
            // Prepend so newest entries appear at the top.
            appendSubmissions([newSubmission]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `challenge_id=eq.${challengeId}`,
        },
        (payload) => {
          updateSubmission(payload.new as Submission);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
          filter: `challenge_id=eq.${challengeId}`,
        },
        (payload) => {
          const vote = payload.new as VoteRow;
          updateVoteCount(vote.submission_id, vote.vote_type);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, cityId, appendSubmissions, updateSubmission, updateVoteCount]);

  return submissions;
}
