import { create } from 'zustand';

type Level = 'wanderer' | 'scout' | 'explorer' | 'chronicler' | 'keeper' | 'legend';

interface User {
  id: string;
  auth_id: string;
  username: string;
  city_id: string;
  level: Level;
  xp: number;
  streak_current: number;
  streak_best: number;
  streak_last_date?: string;
  streak_shields: number;
  gone_plus: boolean;
  gone_pro: boolean;
  avatar_url?: string;
}

const LEVEL_THRESHOLDS: Record<Level, number> = {
  wanderer: 0,
  scout: 500,
  explorer: 1500,
  chronicler: 4000,
  keeper: 10000,
  legend: 25000,
};

const LEVEL_ORDER: Level[] = ['wanderer', 'scout', 'explorer', 'chronicler', 'keeper', 'legend'];

interface UserStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User) => void;
  clearUser: () => void;
  updateXP: (amount: number) => void;
  updateStreak: (current: number, lastDate: string) => void;
  getLevelThresholds: () => Record<Level, number>;
  getNextLevelXP: () => number | null;
  getProgressToNextLevel: () => number;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, error: null }),

  clearUser: () => set({ user: null, error: null }),

  updateXP: (amount) =>
    set((state) => {
      if (!state.user) return state;
      return { user: { ...state.user, xp: state.user.xp + amount } };
    }),

  updateStreak: (current, lastDate) =>
    set((state) => {
      if (!state.user) return state;
      return {
        user: {
          ...state.user,
          streak_current: current,
          streak_last_date: lastDate,
          streak_best: Math.max(state.user.streak_best, current),
        },
      };
    }),

  getLevelThresholds: () => LEVEL_THRESHOLDS,

  getNextLevelXP: () => {
    const { user } = get();
    if (!user) return null;
    const currentIndex = LEVEL_ORDER.indexOf(user.level);
    if (currentIndex === LEVEL_ORDER.length - 1) return null;
    const nextLevel = LEVEL_ORDER[currentIndex + 1];
    return LEVEL_THRESHOLDS[nextLevel];
  },

  getProgressToNextLevel: () => {
    const { user, getNextLevelXP } = get();
    if (!user) return 0;
    const nextXP = getNextLevelXP();
    if (nextXP === null) return 1;
    const currentLevelXP = LEVEL_THRESHOLDS[user.level];
    const range = nextXP - currentLevelXP;
    const progress = user.xp - currentLevelXP;
    return Math.min(Math.max(progress / range, 0), 1);
  },
}));
