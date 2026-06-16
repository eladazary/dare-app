import { create } from 'zustand';

type Difficulty = 'easy' | 'medium' | 'hard';
type Archetype = 'detective' | 'sprint' | 'hyperlocal' | 'narrative' | 'social' | 'detail' | 'condition_lock';

export interface Leg {
  order: number;
  title: string;
  clue: string;
  target: string;
  hint: string;
  center_hint: string;
  radius_m: number;
  points: number;
  vision_checks: Array<{ type: string; target: string; confidence: number }>;
}

export interface DifficultyTier {
  total_time_mins: number;
  total_points: number;
  completion_bonus: number;
  legs: Leg[];
}

export interface Challenge {
  id: string;
  city_id: string;
  date: string;
  archetype: Archetype;
  verification_method: 'ai_vision' | 'community' | 'gps_only' | 'combined';
  narrative_arc: string;
  easy: DifficultyTier;
  medium: DifficultyTier;
  hard: DifficultyTier;
  active_from: string;
  active_until: string;
}

interface ChallengeStore {
  todayChallenge: Challenge | null;
  selectedDifficulty: Difficulty;
  challengeAccepted: boolean;
  acceptedAt: Date | null;
  isRevealed: boolean;
  currentLegIndex: number;
  unlockedLegs: number;

  setChallenge: (challenge: Challenge) => void;
  selectDifficulty: (d: Difficulty) => void;
  acceptChallenge: () => void;
  revealChallenge: () => void;
  completeCurrentLeg: () => void;
  resetDaily: () => void;

  getActiveTier: () => DifficultyTier | null;
  getCurrentLeg: () => Leg | null;
  getTimeRemaining: () => number;
  getTotalLegs: () => number;
  getLegCount: () => { total: number; completed: number };
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  todayChallenge: null,
  selectedDifficulty: 'medium',
  challengeAccepted: false,
  acceptedAt: null,
  isRevealed: false,
  currentLegIndex: 0,
  unlockedLegs: 0,

  setChallenge: (challenge) => set({ todayChallenge: challenge }),

  selectDifficulty: (d) => set({ selectedDifficulty: d }),

  acceptChallenge: () =>
    set({ challengeAccepted: true, acceptedAt: new Date(), unlockedLegs: 1 }),

  revealChallenge: () => set({ isRevealed: true }),

  completeCurrentLeg: () =>
    set((state) => ({
      currentLegIndex: state.currentLegIndex + 1,
      unlockedLegs: state.unlockedLegs + 1,
    })),

  resetDaily: () =>
    set({
      todayChallenge: null,
      selectedDifficulty: 'medium',
      challengeAccepted: false,
      acceptedAt: null,
      isRevealed: false,
      currentLegIndex: 0,
      unlockedLegs: 0,
    }),

  getActiveTier: () => {
    const { todayChallenge, selectedDifficulty } = get();
    if (!todayChallenge) return null;
    return todayChallenge[selectedDifficulty] ?? null;
  },

  getCurrentLeg: () => {
    const { currentLegIndex } = get();
    const tier = get().getActiveTier();
    if (!tier) return null;
    return tier.legs[currentLegIndex] ?? null;
  },

  getTimeRemaining: () => {
    const { acceptedAt } = get();
    if (!acceptedAt) return 0;
    const tier = get().getActiveTier();
    if (!tier) return 0;
    const limitMs = tier.total_time_mins * 60 * 1000;
    const elapsed = Date.now() - acceptedAt.getTime();
    return Math.max(0, Math.floor((limitMs - elapsed) / 1000));
  },

  getTotalLegs: () => {
    const tier = get().getActiveTier();
    return tier ? tier.legs.length : 0;
  },

  getLegCount: () => {
    const { currentLegIndex } = get();
    const total = get().getTotalLegs();
    return { total, completed: currentLegIndex };
  },
}));
