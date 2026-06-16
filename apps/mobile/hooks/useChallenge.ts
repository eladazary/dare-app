import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getChallenge } from '../lib/api';
import { useChallengeStore } from '../stores/challengeStore';

export function useChallenge(cityId: string, date: string) {
  const setChallenge = useChallengeStore((s) => s.setChallenge);

  const result = useQuery({
    queryKey: ['challenge', cityId, date],
    queryFn: () => getChallenge(cityId, date),
    staleTime: 30 * 60 * 1000,
    enabled: Boolean(cityId && date),
  });

  useEffect(() => {
    if (result.data) {
      setChallenge(result.data as any);
    }
  }, [result.data, setChallenge]);

  return {
    challenge: result.data,
    isLoading: result.isLoading,
    error: result.error ? (result.error as Error).message : null,
  };
}
