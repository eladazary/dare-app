import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null | undefined;
  setSession: (session: Session | null) => void;
  preview: boolean;
  setPreview: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: undefined,
  setSession: (session) => set({ session }),
  preview: false,
  setPreview: (v) => set({ preview: v }),
}));
