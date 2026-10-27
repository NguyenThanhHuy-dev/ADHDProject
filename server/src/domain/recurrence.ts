import { sql } from 'drizzle-orm';
import type { Db } from '../db/types';
import type { Tx } from './points';

export type Recurrence = 'none' | 'daily' | 'weekly';

const STEP_DAYS = { daily: 1, weekly: 7 } as const;
const MAX_STEPS = 400;

/**
 * The first due date after `now` in the series that started at `dueAt`, moving by whole days of
 * the user's local calendar. Postgres does the arithmetic so a 23:59 deadline stays 23:59 across
 * daylight-saving changes.
 */
export const nextDueAt = async (
  executor: Db | Tx,
  dueAt: Date,
  recurrence: Exclude<Recurrence, 'none'>,
  timeZone: string,
  now: Date,
): Promise<Date> => {
  const stepDays = STEP_DAYS[recurrence];
  const stepMs = stepDays * 86_400_000;
  // Jump close to `now` first, then walk forward until the result is strictly in the future.
  let steps = Math.max(1, Math.floor((now.getTime() - dueAt.getTime()) / stepMs));

  for (let i = 0; i < 5 && steps <= MAX_STEPS; i++, steps++) {
    const result = await executor.execute(
      sql`select (((${dueAt.toISOString()}::timestamptz at time zone ${timeZone}) + (${steps * stepDays} * interval '1 day')) at time zone ${timeZone}) as next`,
    );
    const next = new Date((result as unknown as { rows: { next: string | Date }[] }).rows[0].next);
    if (next.getTime() > now.getTime()) return next;
  }
  return new Date(now.getTime() + stepMs);
};
