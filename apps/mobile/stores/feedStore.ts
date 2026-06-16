import { create } from 'zustand';

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

interface FeedStore {
  submissions: Submission[];
  isLoading: boolean;
  cursor: string | null;
  hasMore: boolean;
  neighborhoodMode: boolean;
  setSubmissions: (submissions: Submission[]) => void;
  appendSubmissions: (submissions: Submission[]) => void;
  updateSubmission: (updated: Submission) => void;
  toggleNeighborhoodMode: () => void;
  updateVoteCount: (submissionId: string, voteType: 'valid' | 'invalid') => void;
}

export const useFeedStore = create<FeedStore>((set) => ({
  submissions: [],
  isLoading: false,
  cursor: null,
  hasMore: true,
  neighborhoodMode: false,

  setSubmissions: (submissions) => set({ submissions }),

  appendSubmissions: (submissions) =>
    set((state) => ({
      submissions: [...state.submissions, ...submissions],
    })),

  updateSubmission: (updated) =>
    set((state) => ({
      submissions: state.submissions.map((s) => (s.id === updated.id ? updated : s)),
    })),

  toggleNeighborhoodMode: () =>
    set((state) => ({ neighborhoodMode: !state.neighborhoodMode })),

  updateVoteCount: (submissionId, voteType) =>
    set((state) => ({
      submissions: state.submissions.map((s) => {
        if (s.id !== submissionId) return s;
        return voteType === 'valid'
          ? { ...s, votes_valid: s.votes_valid + 1 }
          : { ...s, votes_invalid: s.votes_invalid + 1 };
      }),
    })),
}));
