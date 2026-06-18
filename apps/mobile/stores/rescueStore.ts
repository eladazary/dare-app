import { create } from 'zustand';
import type { RescueRequest } from '@/components/RescueModal';

interface RescueState {
  pendingRescue: RescueRequest | null;
  setPendingRescue: (r: RescueRequest | null) => void;
}

export const useRescueStore = create<RescueState>((set) => ({
  pendingRescue: null,
  setPendingRescue: (r) => set({ pendingRescue: r }),
}));
