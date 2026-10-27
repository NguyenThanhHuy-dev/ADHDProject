import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/types';
import { pomodoroSessions, pushSubscriptions, tasks, users } from '../db/schema';
import type { Tx } from '../domain/points';
import type { PushPayload, PushSender } from '../services/push';

type Executor = Db | Tx;

export interface OutboxItem {
  userId: string;
  payload: PushPayload;
}

/** How long before the due date the "due soon" push goes out. */
export const DUE_LEAD_MINUTES = 60;
/** A session older than this is stale (the app was closed long ago); no "time is up" for it. */
const SESSION_ALERT_WINDOW_HOURS = 6;
const BATCH = 200;

const hasSubscription = sql`exists (select 1 from ${pushSubscriptions} where ${pushSubscriptions.userId} = ${users.id})`;

/**
 * Marks tasks that are due within the next hour as reminded and returns what to send.
 * The mark and the check are one statement, so two API instances can never both claim a task.
 */
export const claimDueReminders = async (executor: Executor, now: Date): Promise<OutboxItem[]> => {
  const horizon = new Date(now.getTime() + DUE_LEAD_MINUTES * 60_000);
  const candidates = await executor
    .select({ id: tasks.id, userId: tasks.userId, title: tasks.title, dueAt: tasks.dueAt })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.userId))
    .where(
      and(
        isNull(tasks.completedAt),
        isNull(tasks.remindedAt),
        gt(tasks.dueAt, now),
        lte(tasks.dueAt, horizon),
        eq(users.notifyDueReminders, true),
        hasSubscription,
      ),
    )
    .limit(BATCH);

  const outbox: OutboxItem[] = [];
  for (const task of candidates) {
    const claimed = await executor
      .update(tasks)
      .set({ remindedAt: now })
      .where(and(eq(tasks.id, task.id), isNull(tasks.remindedAt)))
      .returning({ id: tasks.id });
    if (claimed.length === 0 || !task.dueAt) continue;
    const minutes = Math.max(1, Math.round((task.dueAt.getTime() - now.getTime()) / 60_000));
    outbox.push({
      userId: task.userId,
      payload: {
        title: 'Task due soon',
        body: `"${task.title}" is due in ${minutes} min`,
        tag: `task-${task.id}`,
        url: '/tasks',
      },
    });
  }
  return outbox;
};

/** Sessions whose planned time has passed while the user may have left the app. */
export const claimTimerEnds = async (executor: Executor, now: Date): Promise<OutboxItem[]> => {
  const since = new Date(now.getTime() - SESSION_ALERT_WINDOW_HOURS * 3_600_000);
  const finished = sql`${pomodoroSessions.startedAt} + (${pomodoroSessions.plannedMinutes} * interval '1 minute') <= ${now.toISOString()}::timestamptz`;
  const candidates = await executor
    .select({ id: pomodoroSessions.id, userId: pomodoroSessions.userId })
    .from(pomodoroSessions)
    .innerJoin(users, eq(users.id, pomodoroSessions.userId))
    .where(
      and(
        eq(pomodoroSessions.status, 'active'),
        isNull(pomodoroSessions.notifiedAt),
        gt(pomodoroSessions.startedAt, since),
        finished,
        eq(users.notifyTimerEnd, true),
        hasSubscription,
      ),
    )
    .limit(BATCH);

  const outbox: OutboxItem[] = [];
  for (const session of candidates) {
    const claimed = await executor
      .update(pomodoroSessions)
      .set({ notifiedAt: now })
      .where(and(eq(pomodoroSessions.id, session.id), isNull(pomodoroSessions.notifiedAt)))
      .returning({ id: pomodoroSessions.id });
    if (claimed.length === 0) continue;
    outbox.push({
      userId: session.userId,
      payload: {
        title: 'Focus session done',
        body: 'Time for a break. Open the timer to log your session.',
        tag: `session-${session.id}`,
        url: '/pomodoro',
        // The timer in an open window already rings; do not double up.
        skipIfFocused: true,
      },
    });
  }
  return outbox;
};

export interface DeliveryResult {
  sent: number;
  gone: number;
  failed: number;
}

/** Sends to every browser the user registered and forgets subscriptions the browser dropped. */
export const sendToUser = async (
  db: Db,
  sender: PushSender,
  userId: string,
  payload: PushPayload,
): Promise<DeliveryResult> => {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  const result: DeliveryResult = { sent: 0, gone: 0, failed: 0 };
  for (const sub of subs) {
    const outcome = await sender.send(sub, payload);
    result[outcome] += 1;
    if (outcome === 'gone')
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
  }
  return result;
};

export const deliverOutbox = async (db: Db, sender: PushSender, outbox: OutboxItem[]) => {
  const total: DeliveryResult = { sent: 0, gone: 0, failed: 0 };
  for (const item of outbox) {
    const r = await sendToUser(db, sender, item.userId, item.payload);
    total.sent += r.sent;
    total.gone += r.gone;
    total.failed += r.failed;
  }
  return total;
};
