import { create } from 'zustand';

export interface Tournament {
  id: string;
  type: 'city_championship' | 'sprint' | 'crew_wars' | 'photo_slam';
  status: 'upcoming' | 'registration' | 'active' | 'completed';
  cityId: string;
  challengerCityId?: string;
  cityScore: number;
  challengerCityScore: number;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
  participantCount: number;
}

export interface Duel {
  id: string;
  challengerId: string;
  opponentId: string;
  challengerSubmissionId?: string;
  opponentSubmissionId?: string;
  status: 'pending' | 'active' | 'voting' | 'completed';
  winnerId?: string;
  votesChallenger: number;
  votesOpponent: number;
  pointsStake: number;
}

interface TournamentStore {
  activeTournament: Tournament | null;
  activeDuel: Duel | null;
  userRank: number | null;
  isRegistered: boolean;
  setActiveTournament: (t: Tournament | null) => void;
  setActiveDuel: (d: Duel | null) => void;
  setRegistered: (v: boolean) => void;
  setUserRank: (r: number) => void;
}

export const useTournamentStore = create<TournamentStore>((set) => ({
  activeTournament: null,
  activeDuel: null,
  userRank: null,
  isRegistered: false,

  setActiveTournament: (t) => set({ activeTournament: t }),
  setActiveDuel: (d) => set({ activeDuel: d }),
  setRegistered: (v) => set({ isRegistered: v }),
  setUserRank: (r) => set({ userRank: r }),
}));
