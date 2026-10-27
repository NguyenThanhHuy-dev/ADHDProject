export const STREAK_MINUTES_PER_DAY = 60;
export const STREAK_BONUS_PER_DAY = 10;

/** Calendar date (YYYY-MM-DD) of `instant` in the given IANA time zone. */
export const localDate = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

export const previousDay = (day: string): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export interface StreakState {
  currentStreak: number;
  lastStreakDate: string | null;
}

/** A streak that was not extended yesterday or today is over, even if the row still says otherwise. */
export const effectiveStreak = (state: StreakState, today: string): number =>
  state.lastStreakDate === today || state.lastStreakDate === previousDay(today)
    ? state.currentStreak
    : 0;

/**
 * Applies today's focus total to the streak. Only reaching the daily goal changes it:
 * a short session never resets an existing streak.
 */
export const applyFocus = (
  state: StreakState,
  todayMinutes: number,
  today: string,
): { state: StreakState; extended: boolean } => {
  if (todayMinutes < STREAK_MINUTES_PER_DAY || state.lastStreakDate === today) {
    return { state, extended: false };
  }
  const continues = state.lastStreakDate === previousDay(today);
  return {
    state: { currentStreak: continues ? state.currentStreak + 1 : 1, lastStreakDate: today },
    extended: true,
  };
};

export const streakBonus = (streak: number): number =>
  streak >= 2 ? streak * STREAK_BONUS_PER_DAY : 0;
