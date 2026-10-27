import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pomodoroSessions, tasks, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { daysBetween, lastWeekStarts, longestRun, weekStart } from '../src/domain/stats';
import { createTestApp, makeClock, registerUser, type TestApp } from './helpers';

describe('stats helpers', () => {
  it('finds the Monday of a week', () => {
    expect(weekStart('2030-06-10')).toBe('2030-06-10'); // Monday
    expect(weekStart('2030-06-16')).toBe('2030-06-10'); // Sunday
    expect(weekStart('2030-06-11')).toBe('2030-06-10');
  });

  it('lists consecutive week starts, oldest first', () => {
    expect(lastWeekStarts('2030-06-12', 3)).toEqual(['2030-05-27', '2030-06-03', '2030-06-10']);
  });

  it('lists every day in a range', () => {
    expect(daysBetween('2030-02-27', '2030-03-02')).toEqual([
      '2030-02-27',
      '2030-02-28',
      '2030-03-01',
      '2030-03-02',
    ]);
  });

  it('finds the longest run of days that reached the goal', () => {
    const daily = new Map([
      ['2030-06-01', 60],
      ['2030-06-02', 90],
      ['2030-06-03', 30], // below goal breaks the run
      ['2030-06-04', 60],
      ['2030-06-05', 60],
      ['2030-06-06', 60],
    ]);
    expect(longestRun(daily, 60)).toBe(3);
    expect(longestRun(new Map(), 60)).toBe(0);
  });
});

const clock = makeClock('2030-06-12T08:00:00Z'); // Wednesday
let app: TestApp;
let close: () => Promise<void>;
let cookie: string;
let userId: string;

const addSession = (minutes: number, completedAtIso: string, uid = userId) =>
  app.db.insert(pomodoroSessions).values({
    userId: uid,
    plannedMinutes: minutes,
    status: 'completed',
    startedAt: new Date(new Date(completedAtIso).getTime() - minutes * 60_000),
    completedAt: new Date(completedAtIso),
  });

const get = async (url: string, c = cookie) =>
  (await app.inject({ method: 'GET', url, headers: { cookie: c } })).json();

beforeAll(async () => {
  ({ app, close } = await createTestApp({ now: clock.now }));
  cookie = (
    await registerUser(app, 'stats@example.com', 'password123', { timezone: 'Asia/Ho_Chi_Minh' })
  ).cookie;
  [{ id: userId }] = await app.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'stats@example.com'));

  // 20:30 UTC on 06-10 is 03:30 on 06-11 in Ho Chi Minh City (UTC+7).
  await addSession(60, '2030-06-10T20:30:00Z');
  await addSession(25, '2030-06-11T03:00:00Z'); // 10:00 local, 06-11
  await addSession(25, '2030-06-11T03:30:00Z'); // 10:30 local, 06-11
  await addSession(45, '2030-06-05T02:00:00Z'); // 09:00 local, 06-05 (previous week)
  await app.db.insert(tasks).values([
    { userId, title: 'a', quadrant: 'q1', completedAt: new Date('2030-06-11T05:00:00Z') },
    { userId, title: 'b', quadrant: 'q1', completedAt: new Date('2030-06-05T05:00:00Z') },
    { userId, title: 'c', quadrant: 'q2' },
  ]);
});
afterAll(() => close());

describe('GET /api/stats/heatmap', () => {
  it('returns one entry per local day, with empty days included', async () => {
    const res = await get('/api/stats/heatmap?weeks=2');
    expect(res.days).toHaveLength(14);
    expect(res.to).toBe('2030-06-12');
    expect(res.from).toBe('2030-05-30');
    const byDate = Object.fromEntries(res.days.map((d: { date: string }) => [d.date, d]));
    // The 20:30 UTC session belongs to the 11th for this user, not the 10th.
    expect(byDate['2030-06-10'].minutes).toBe(0);
    expect(byDate['2030-06-11']).toMatchObject({ minutes: 110, sessions: 3 });
    expect(byDate['2030-06-05']).toMatchObject({ minutes: 45, sessions: 1 });
    expect(byDate['2030-06-12'].minutes).toBe(0);
  });

  it('validates the window size', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/stats/heatmap?weeks=99',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/stats/hours', () => {
  it('groups focus time by local hour and names the best one', async () => {
    const res = await get('/api/stats/hours');
    expect(res.hours).toHaveLength(24);
    expect(res.hours[3].minutes).toBe(60);
    expect(res.hours[10].minutes).toBe(50);
    expect(res.hours[9].minutes).toBe(45);
    expect(res.bestHour).toBe(3);
  });
});

describe('GET /api/stats/weekly', () => {
  it('returns Monday-based weeks with focus and completed tasks', async () => {
    const res = await get('/api/stats/weekly?weeks=3');
    expect(res.weeks.map((w: { weekStart: string }) => w.weekStart)).toEqual([
      '2030-05-27',
      '2030-06-03',
      '2030-06-10',
    ]);
    const [, previous, current] = res.weeks;
    expect(previous).toMatchObject({ minutes: 45, sessions: 1, tasksCompleted: 1 });
    expect(current).toMatchObject({ minutes: 110, sessions: 3, tasksCompleted: 1 });
  });
});

describe('GET /api/stats/overview', () => {
  it('summarises tasks and focus', async () => {
    const res = await get('/api/stats/overview');
    expect(res.tasks).toMatchObject({ done: 2, open: 1, completionRate: 67 });
    expect(res.tasks.byQuadrant).toEqual([
      { quadrant: 'q1', done: 2, open: 0 },
      { quadrant: 'q2', done: 0, open: 1 },
    ]);
    expect(res.focus).toMatchObject({
      totalMinutes: 155,
      totalSessions: 4,
      activeDays: 2,
      avgMinutesPerActiveDay: 78,
      bestDay: { day: '2030-06-11', minutes: 110 },
      longestStreakDays: 1,
    });
  });

  it('is empty, not an error, for a new user', async () => {
    const fresh = (await registerUser(app, 'fresh-stats@example.com')).cookie;
    const res = await get('/api/stats/overview', fresh);
    expect(res.tasks).toMatchObject({ done: 0, open: 0, completionRate: 0, byQuadrant: [] });
    expect(res.focus).toMatchObject({ totalMinutes: 0, bestDay: null, longestStreakDays: 0 });
    expect((await get('/api/stats/hours', fresh)).bestHour).toBeNull();
    expect(
      (await get('/api/stats/heatmap', fresh)).days.every(
        (d: { minutes: number }) => d.minutes === 0,
      ),
    ).toBe(true);
  });

  it("never mixes in another user's data and requires login", async () => {
    const other = (await registerUser(app, 'other-stats@example.com')).cookie;
    expect((await get('/api/stats/overview', other)).focus.totalMinutes).toBe(0);
    expect((await app.inject({ method: 'GET', url: '/api/stats/overview' })).statusCode).toBe(401);
  });
});
