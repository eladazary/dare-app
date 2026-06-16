import { create } from 'zustand';

export interface Crew {
  id: string;
  name: string;
  founderId: string;
  cityId: string;
  xpTotal: number;
  memberCount: number;
}

export interface Expedition {
  id: string;
  planterId: string;
  clueText: string;
  cluePhotoUrl?: string;
  pointsStake: number;
  expiresAt: string;
  status: 'active' | 'found' | 'expired';
}

export interface RelayChain {
  id: string;
  challengeId: string;
  cityId: string;
  linkCount: number;
  myPosition?: number;
}

export interface ParallelMatch {
  id: string;
  partnerId: string;
  partnerCity: string;
  partnerSubmissionId?: string;
  mySubmissionId?: string;
  revealed: boolean;
}

interface SocialStore {
  crew: Crew | null;
  expeditions: Expedition[];
  activeRelay: RelayChain | null;
  parallelMatch: ParallelMatch | null;
  referralCode: string | null;
  inviteCount: number;
  setCrew: (c: Crew | null) => void;
  setExpeditions: (e: Expedition[]) => void;
  setActiveRelay: (r: RelayChain | null) => void;
  setParallelMatch: (m: ParallelMatch | null) => void;
  setReferralCode: (code: string) => void;
  setInviteCount: (n: number) => void;
}

export const useSocialStore = create<SocialStore>((set) => ({
  crew: null,
  expeditions: [],
  activeRelay: null,
  parallelMatch: null,
  referralCode: null,
  inviteCount: 0,

  setCrew: (c) => set({ crew: c }),
  setExpeditions: (e) => set({ expeditions: e }),
  setActiveRelay: (r) => set({ activeRelay: r }),
  setParallelMatch: (m) => set({ parallelMatch: m }),
  setReferralCode: (code) => set({ referralCode: code }),
  setInviteCount: (n) => set({ inviteCount: n }),
}));
