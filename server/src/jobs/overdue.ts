import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/types';
import { pointLedger, tasks, users } from '../db/schema';
import { award, getBalance, QUADRANT_POINTS, type Tx } from '../domain/points';

type Executor = Db | Tx;

const BATCH = 500;

/**
 * Charges the quadrant's points for every open task whose due date has passed.
 *
 * Safe to run any number of times: each task is processed once (the ledger row is unique per task),
 * a task that was paid for is never charged, and a user can never be pushed below zero. A task that
 * could not be charged because the balance was empty still gets a zero row, so earning points later
 * does not trigger a retroactive penalty.
 */
export const penalizeOverdueTasks = async (db: Executor, now: Date) => {
  const overdue = await db
    .select({ id: tasks.id, userId: tasks.userId, quadrant: tasks.quadrant })
    .from(tasks)
    .leftJoin(
      pointLedger,
      and(
        eq(pointLedger.userId, tasks.userId),
        eq(pointLedger.reason, 'task_overdue'),
        eq(pointLedger.refId, tasks.id),
      ),
    )
    .where(and(isNull(tasks.completedAt), lt(tasks.dueAt, now), isNull(pointLedger.id)))
    .limit(BATCH);

  let penalized = 0;
  let points = 0;
  for (const task of overdue) {
    await db.transaction(async (tx) => {
      // Same lock the gacha takes, so a charge cannot race with a spend.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, task.userId)).for('update');
      const balance = await getBalance(tx, task.userId);
      const penalty = Math.min(QUADRANT_POINTS[task.quadrant], balance);
      if (await award(tx, task.userId, -penalty, 'task_overdue', task.id)) {
        penalized += 1;
        points += penalty;
      }
    });
  }
  return { checked: overdue.length, penalized, points };
};

/** Cluster-wide lock id: only one API instance runs the scheduled jobs at a time. */
const JOBS_LOCK = sql`hashtext('adhd.scheduled-jobs')`;

export const runScheduledJobs = async (db: Db, now: Date) =>
  db.transaction(async (tx) => {
    const result = await tx.execute(sql`select pg_try_advisory_xact_lock(${JOBS_LOCK}) as locked`);
    const locked = (result as unknown as { rows: { locked: boolean }[] }).rows[0]?.locked;
    if (!locked) return { skipped: true as const };
    return { skipped: false as const, overdue: await penalizeOverdueTasks(tx, now) };
  });
