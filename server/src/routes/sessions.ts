import { and, desc, eq, gte } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pomodoroSessions, tasks, userStreaks, users } from '../db/schema';
import { award, getBalance, SESSION_POINTS } from '../domain/points';
import { applyFocus, effectiveStreak, localDate, streakBonus } from '../domain/streak';

export const ALLOWED_MINUTES = [15, 25, 45, 60, 90, 120] as const;
/** A client may finish a hair early (timer rounding, network); anything more is rejected. */
const TOLERANCE_MS = 5_000;

const startBody = z.object({
  taskId: z.string().uuid().nullable().default(null),
  plannedMinutes: z
    .number()
    .int()
    .refine((n) => (ALLOWED_MINUTES as readonly number[]).includes(n), {
      message: `plannedMinutes must be one of ${ALLOWED_MINUTES.join(', ')}`,
    }),
});
const idParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const getTimezone = async (userId: string) => {
    const [u] = await app.db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId));
    return u?.tz ?? 'UTC';
  };

  // Starting a session abandons any session that is still running.
  app.post('/start', async (request, reply) => {
    const body = startBody.parse(request.body);
    const userId = request.user.sub;
    if (body.taskId) {
      const [task] = await app.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, body.taskId), eq(tasks.userId, userId)));
      if (!task) return reply.status(404).send({ error: 'Task not found' });
    }
    const session = await app.db.transaction(async (tx) => {
      await tx
        .update(pomodoroSessions)
        .set({ status: 'abandoned' })
        .where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.status, 'active')));
      const [row] = await tx
        .insert(pomodoroSessions)
        .values({
          userId,
          taskId: body.taskId,
          plannedMinutes: body.plannedMinutes,
          startedAt: app.now(),
        })
        .returning();
      return row;
    });
    return reply.status(201).send(session);
  });

  app.post('/:id/cancel', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [row] = await app.db
      .update(pomodoroSessions)
      .set({ status: 'abandoned' })
      .where(
        and(
          eq(pomodoroSessions.id, id),
          eq(pomodoroSessions.userId, request.user.sub),
          eq(pomodoroSessions.status, 'active'),
        ),
      )
      .returning();
    if (!row) return reply.status(404).send({ error: 'No active session with that id' });
    return row;
  });

  // Pays out once, inside one transaction: session status, points, streak and streak bonus.
  app.post('/:id/complete', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const userId = request.user.sub;
    const timeZone = await getTimezone(userId);
    const now = app.now();

    const result = await app.db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(pomodoroSessions)
        .where(and(eq(pomodoroSessions.id, id), eq(pomodoroSessions.userId, userId)))
        .for('update');
      if (!session) return { status: 404 as const, body: { error: 'Session not found' } };

      const today = localDate(now, timeZone);
      const [streakRow] = await tx.select().from(userStreaks).where(eq(userStreaks.userId, userId));
      const streak = streakRow ?? { currentStreak: 0, lastStreakDate: null };

      if (session.status === 'completed') {
        return {
          status: 200 as const,
          body: {
            session,
            alreadyCompleted: true,
            pointsAwarded: 0,
            balance: await getBalance(tx, userId),
            streak: effectiveStreak(streak, today),
          },
        };
      }
      if (session.status !== 'active') {
        return { status: 409 as const, body: { error: `Session was ${session.status}` } };
      }

      const elapsedMs = now.getTime() - session.startedAt.getTime();
      const requiredMs = session.plannedMinutes * 60_000 - TOLERANCE_MS;
      if (elapsedMs < requiredMs) {
        return {
          status: 422 as const,
          body: {
            error: 'Session is not finished yet',
            remainingSeconds: Math.ceil((requiredMs - elapsedMs) / 1000),
          },
        };
      }

      const [completed] = await tx
        .update(pomodoroSessions)
        .set({ status: 'completed', completedAt: now })
        .where(eq(pomodoroSessions.id, id))
        .returning();

      let pointsAwarded = 0;
      if (await award(tx, userId, SESSION_POINTS, 'session_complete', id)) {
        pointsAwarded += SESSION_POINTS;
      }

      const since = new Date(now.getTime() - 48 * 3_600_000);
      const recent = await tx
        .select({
          completedAt: pomodoroSessions.completedAt,
          minutes: pomodoroSessions.plannedMinutes,
        })
        .from(pomodoroSessions)
        .where(
          and(
            eq(pomodoroSessions.userId, userId),
            eq(pomodoroSessions.status, 'completed'),
            gte(pomodoroSessions.completedAt, since),
          ),
        );
      const todayMinutes = recent
        .filter((r) => r.completedAt && localDate(r.completedAt, timeZone) === today)
        .reduce((sum, r) => sum + r.minutes, 0);

      const { state: next, extended } = applyFocus(streak, todayMinutes, today);
      if (extended) {
        await tx
          .insert(userStreaks)
          .values({ userId, ...next })
          .onConflictDoUpdate({ target: userStreaks.userId, set: next });
        const bonus = streakBonus(next.currentStreak);
        if (bonus > 0 && (await award(tx, userId, bonus, 'streak_bonus', id))) {
          pointsAwarded += bonus;
        }
      }

      return {
        status: 200 as const,
        body: {
          session: completed,
          alreadyCompleted: false,
          pointsAwarded,
          balance: await getBalance(tx, userId),
          streak: effectiveStreak(next, today),
          todayMinutes,
        },
      };
    });

    return reply.status(result.status).send(result.body);
  });

  app.get('/', async (request) => {
    const { limit } = listQuery.parse(request.query);
    return app.db
      .select()
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.userId, request.user.sub),
          eq(pomodoroSessions.status, 'completed'),
        ),
      )
      .orderBy(desc(pomodoroSessions.completedAt))
      .limit(limit);
  });

  app.get('/streak', async (request) => {
    const userId = request.user.sub;
    const timeZone = await getTimezone(userId);
    const today = localDate(app.now(), timeZone);
    const [row] = await app.db.select().from(userStreaks).where(eq(userStreaks.userId, userId));
    const state = row ?? { currentStreak: 0, lastStreakDate: null };
    return {
      currentStreak: effectiveStreak(state, today),
      lastStreakDate: state.lastStreakDate,
      goalReachedToday: state.lastStreakDate === today,
      nextBonus: streakBonus(
        effectiveStreak(state, today) + (state.lastStreakDate === today ? 0 : 1),
      ),
    };
  });
};
