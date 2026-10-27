/** Date helpers for the stats endpoints. All dates are "YYYY-MM-DD" in the user's time zone. */

const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Monday of the week containing `day`. */
export const weekStart = (day: string): string => {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
};

/** `count` consecutive week starts ending with the week of `today`, oldest first. */
export const lastWeekStarts = (today: string, count: number): string[] => {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
};

/** Every day from `from` to `to` inclusive, oldest first. */
export const daysBetween = (from: string, to: string): string[] => {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};

export const dayOffset = addDays;

/** Longest run of consecutive days that reached `goal` minutes. */
export const longestRun = (daily: Map<string, number>, goal: number): number => {
  const days = [...daily.entries()]
    .filter(([, minutes]) => minutes >= goal)
    .map(([day]) => day)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
};
