import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pomodoroSessions, tasks, users } from '../db/schema';
import { localDate } from '../domain/streak';
import { STREAK_MINUTES_PER_DAY } from '../domain/streak';
import { dayOffset, daysBetween, lastWeekStarts, longestRun } from '../domain/stats';

const DAY_MS = 86_400_000;

const heatmapQuery = z.object({ weeks: z.coerce.number().int().min(1).max(52).default(26) });
const weeklyQuery = z.object({ weeks: z.coerce.number().int().min(1).max(26).default(8) });

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const getTimezone = async (userId: string) => {
    const [u] = await app.db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId));
    return u?.tz ?? 'UTC';
  };

  // Note: grouping is by column position (`1`). Each `${timeZone}` is a separate bound parameter,
  // so Postgres cannot tell a repeated expression is the same one and would reject the query.
  /** Focus minutes per local calendar day since `since`. */
  const dailyFocus = async (userId: string, timeZone: string, since: Date) => {
    const day = sql<string>`to_char((${pomodoroSessions.completedAt} at time zone ${timeZone})::date, 'YYYY-MM-DD')`;
    const rows = await app.db
      .select({
        day,
        minutes: sql<number>`sum(${pomodoroSessions.plannedMinutes})::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.userId, userId),
          eq(pomodoroSessions.status, 'completed'),
          gte(pomodoroSessions.completedAt, since),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    return rows;
  };

  // One entry per day, including empty ones, so the client can draw the grid without gap logic.
  app.get('/heatmap', async (request) => {
    const { weeks } = heatmapQuery.parse(request.query);
    const userId = request.user.sub;
    const timeZone = await getTimezone(userId);
    const now = app.now();
    const today = localDate(now, timeZone);
    const from = dayOffset(today, -(weeks * 7 - 1));
    // Fetch a day more on each side of the window: the local-day filter below trims the excess.
    const rows = await dailyFocus(
      userId,
      timeZone,
      new Date(now.getTime() - (weeks * 7 + 1) * DAY_MS),
    );
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const days = daysBetween(from, today).map((date) => ({
      date,
      minutes: byDay.get(date)?.minutes ?? 0,
      sessions: byDay.get(date)?.sessions ?? 0,
    }));
    return { timeZone, from, to: today, days };
  });

  // When during the day the user finishes sessions (last 90 days), to find their best hour.
  app.get('/hours', async (request) => {
    const userId = request.user.sub;
    const timeZone = await getTimezone(userId);
    const since = new Date(app.now().getTime() - 90 * DAY_MS);
    const hour = sql<number>`extract(hour from (${pomodoroSessions.completedAt} at time zone ${timeZone}))::int`;
    const rows = await app.db
      .select({ hour, minutes: sql<number>`sum(${pomodoroSessions.plannedMinutes})::int` })
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.userId, userId),
          eq(pomodoroSessions.status, 'completed'),
          gte(pomodoroSessions.completedAt, since),
        ),
      )
      .groupBy(sql`1`);
    const byHour = new Map(rows.map((r) => [r.hour, r.minutes]));
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, minutes: byHour.get(h) ?? 0 }));
    const best = hours.reduce((a, b) => (b.minutes > a.minutes ? b : a));
    return { timeZone, hours, bestHour: best.minutes > 0 ? best.hour : null };
  });

  app.get('/weekly', async (request) => {
    const { weeks } = weeklyQuery.parse(request.query);
    const userId = request.user.sub;
    const timeZone = await getTimezone(userId);
    const now = app.now();
    const starts = lastWeekStarts(localDate(now, timeZone), weeks);
    const since = new Date(now.getTime() - (weeks * 7 + 7) * DAY_MS);

    const focusWeek = sql<string>`to_char(date_trunc('week', ${pomodoroSessions.completedAt} at time zone ${timeZone}), 'YYYY-MM-DD')`;
    const focus = await app.db
      .select({
        week: focusWeek,
        minutes: sql<number>`sum(${pomodoroSessions.plannedMinutes})::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(pomodoroSessions)
      .where(
        and(
          eq(pomodoroSessions.userId, userId),
          eq(pomodoroSessions.status, 'completed'),
          gte(pomodoroSessions.completedAt, since),
        ),
      )
      .groupBy(sql`1`);

    const taskWeek = sql<string>`to_char(date_trunc('week', ${tasks.completedAt} at time zone ${timeZone}), 'YYYY-MM-DD')`;
    const done = await app.db
      .select({ week: taskWeek, tasks: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(eq(tasks.userId, userId), isNotNull(tasks.completedAt), gte(tasks.completedAt, since)),
      )
      .groupBy(sql`1`);

    const focusBy = new Map(focus.map((r) => [r.week, r]));
    const doneBy = new Map(done.map((r) => [r.week, r.tasks]));
    return {
      timeZone,
      weeks: starts.map((weekStart) => ({
        weekStart,
        minutes: focusBy.get(weekStart)?.minutes ?? 0,
        sessions: focusBy.get(weekStart)?.sessions ?? 0,
        tasksCompleted: doneBy.get(weekStart) ?? 0,
      })),
    };
  });

  app.get('/overview', async (request) => {
    const userId = request.user.sub;
    const timeZone = await getTimezone(userId);
    const now = app.now();

    const byQuadrant = await app.db
      .select({
        quadrant: tasks.quadrant,
        done: sql<number>`count(*) filter (where ${tasks.completedAt} is not null)::int`,
        open: sql<number>`count(*) filter (where ${tasks.completedAt} is null)::int`,
      })
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .groupBy(tasks.quadrant)
      .orderBy(tasks.quadrant);

    const daily = await dailyFocus(userId, timeZone, new Date(now.getTime() - 366 * DAY_MS));
    const dailyMap = new Map(daily.map((d) => [d.day, d.minutes]));
    const totalMinutes = daily.reduce((sum, d) => sum + d.minutes, 0);
    const totalSessions = daily.reduce((sum, d) => sum + d.sessions, 0);
    const bestDay = daily.reduce<{ day: string; minutes: number } | null>(
      (best, d) => (!best || d.minutes > best.minutes ? { day: d.day, minutes: d.minutes } : best),
      null,
    );

    const totalDone = byQuadrant.reduce((s, q) => s + q.done, 0);
    const totalAll = byQuadrant.reduce((s, q) => s + q.done + q.open, 0);
    return {
      timeZone,
      tasks: {
        done: totalDone,
        open: totalAll - totalDone,
        completionRate: totalAll ? Math.round((totalDone / totalAll) * 100) : 0,
        byQuadrant,
      },
      focus: {
        totalMinutes,
        totalSessions,
        activeDays: daily.length,
        avgMinutesPerActiveDay: daily.length ? Math.round(totalMinutes / daily.length) : 0,
        bestDay,
        longestStreakDays: longestRun(dailyMap, STREAK_MINUTES_PER_DAY),
      },
    };
  });
};
