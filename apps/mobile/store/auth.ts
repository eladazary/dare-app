import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  /**
   * undefined = not yet resolved (splash still showing)
   * null      = no session (unauthenticated)
   * Session   = authenticated
   */
  session: Session | null | undefined;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: undefined,
  setSession: (session) => set({ session }),
}));
