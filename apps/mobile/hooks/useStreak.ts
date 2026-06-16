import dayjs from 'dayjs';
import { useUserStore } from '../stores/userStore';

export function useStreak() {
  const user = useUserStore((s) => s.user);

  const streakCurrent = user?.streak_current ?? 0;
  const streakBest = user?.streak_best ?? 0;
  const streakShields = user?.streak_shields ?? 0;

  const today = dayjs().format('YYYY-MM-DD');
  const isAtRisk = user?.streak_last_date !== today;

  // Warn late in the day when a long streak is about to break.
  const shouldShowWarning =
    streakCurrent > 7 && isAtRisk && dayjs().hour() >= 22;

  return {
    streakCurrent,
    streakBest,
    streakShields,
    isAtRisk,
    shouldShowWarning,
  };
}
