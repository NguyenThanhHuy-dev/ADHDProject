import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/types';
import { pointLedger } from '../db/schema';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

export const QUADRANT_POINTS = { q1: 15, q2: 10, q3: 5, q4: 1 } as const;
export const SESSION_POINTS = 10;

type Reason = (typeof pointLedger.$inferInsert)['reason'];

export const getBalance = async (executor: Executor, userId: string): Promise<number> => {
  const [row] = await executor
    .select({ total: sql<number>`coalesce(sum(${pointLedger.amount}), 0)::int` })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  return row.total;
};

/**
 * Appends a ledger row. Returns false when this (user, reason, ref) was already paid out,
 * so callers can retry safely without double-awarding.
 */
export const award = async (
  executor: Executor,
  userId: string,
  amount: number,
  reason: Reason,
  refId: string | null,
): Promise<boolean> => {
  const inserted = await executor
    .insert(pointLedger)
    .values({ userId, amount, reason, refId })
    .onConflictDoNothing()
    .returning({ id: pointLedger.id });
  return inserted.length > 0;
};
