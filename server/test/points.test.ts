import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, makeClock, registerUser, type TestApp } from './helpers';

const clock = makeClock();
let app: TestApp;
let close: () => Promise<void>;
let seq = 0;

beforeAll(async () => {
  ({ app, close } = await createTestApp({ now: clock.now }));
});
afterAll(() => close());

const newUser = async (extra: object = {}) =>
  (await registerUser(app, `u${++seq}@example.com`, 'password123', extra)).cookie;
const call = (cookie: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, payload });
const startSession = async (cookie: string, plannedMinutes = 25, taskId: string | null = null) =>
  (await call(cookie, 'POST', '/api/sessions/start', { plannedMinutes, taskId })).json();
const balance = async (cookie: string) => (await call(cookie, 'GET', '/api/points')).json().balance;

describe('task points', () => {
  it('pays by quadrant once, even when completed twice', async () => {
    const cookie = await newUser();
    const { id } = (
      await call(cookie, 'POST', '/api/tasks', { title: 'Big one', quadrant: 'q1' })
    ).json();
    const first = await call(cookie, 'POST', `/api/tasks/${id}/complete`);
    const second = await call(cookie, 'POST', `/api/tasks/${id}/complete`);
    expect(first.json().pointsAwarded).toBe(15);
    expect(second.json().pointsAwarded).toBe(0);
    expect(await balance(cookie)).toBe(15);
  });

  it.each([
    ['q2', 10],
    ['q3', 5],
    ['q4', 1],
  ])('%s pays %i points', async (quadrant, points) => {
    const cookie = await newUser();
    const { id } = (await call(cookie, 'POST', '/api/tasks', { title: 't', quadrant })).json();
    expect((await call(cookie, 'POST', `/api/tasks/${id}/complete`)).json().pointsAwarded).toBe(
      points,
    );
  });

  it('does not pay for a task that belongs to someone else', async () => {
    const owner = await newUser();
    const thief = await newUser();
    const { id } = (await call(owner, 'POST', '/api/tasks', { title: 't', quadrant: 'q1' })).json();
    expect((await call(thief, 'POST', `/api/tasks/${id}/complete`)).statusCode).toBe(404);
    expect(await balance(thief)).toBe(0);
  });
});

describe('sessions', () => {
  it('validates the planned length and the task', async () => {
    const cookie = await newUser();
    expect(
      (await call(cookie, 'POST', '/api/sessions/start', { plannedMinutes: 7 })).statusCode,
    ).toBe(400);
    const other = await newUser();
    const { id } = (await call(other, 'POST', '/api/tasks', { title: 't', quadrant: 'q1' })).json();
    const res = await call(cookie, 'POST', '/api/sessions/start', {
      plannedMinutes: 25,
      taskId: id,
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects completing a session before its time is up', async () => {
    const cookie = await newUser();
    const session = await startSession(cookie, 25);
    clock.advanceMinutes(10);
    const res = await call(cookie, 'POST', `/api/sessions/${session.id}/complete`);
    expect(res.statusCode).toBe(422);
    expect(res.json().remainingSeconds).toBeGreaterThan(14 * 60);
    expect(await balance(cookie)).toBe(0);
  });

  it('pays 10 points when the full time has passed, and only once', async () => {
    const cookie = await newUser();
    const session = await startSession(cookie, 25);
    clock.advanceMinutes(25);
    const first = await call(cookie, 'POST', `/api/sessions/${session.id}/complete`);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ pointsAwarded: 10, balance: 10, alreadyCompleted: false });
    const again = await call(cookie, 'POST', `/api/sessions/${session.id}/complete`);
    expect(again.json()).toMatchObject({ pointsAwarded: 0, balance: 10, alreadyCompleted: true });
  });

  it("cannot complete another user's session", async () => {
    const owner = await newUser();
    const other = await newUser();
    const session = await startSession(owner, 15);
    clock.advanceMinutes(15);
    expect((await call(other, 'POST', `/api/sessions/${session.id}/complete`)).statusCode).toBe(
      404,
    );
  });

  it('abandons the running session when a new one starts', async () => {
    const cookie = await newUser();
    const first = await startSession(cookie, 25);
    const second = await startSession(cookie, 25);
    clock.advanceMinutes(25);
    expect((await call(cookie, 'POST', `/api/sessions/${first.id}/complete`)).statusCode).toBe(409);
    expect((await call(cookie, 'POST', `/api/sessions/${second.id}/complete`)).statusCode).toBe(
      200,
    );
  });

  it('can cancel a running session, which then pays nothing', async () => {
    const cookie = await newUser();
    const session = await startSession(cookie, 25);
    expect((await call(cookie, 'POST', `/api/sessions/${session.id}/cancel`)).statusCode).toBe(200);
    clock.advanceMinutes(30);
    expect((await call(cookie, 'POST', `/api/sessions/${session.id}/complete`)).statusCode).toBe(
      409,
    );
    expect(await balance(cookie)).toBe(0);
  });
});

describe('streak', () => {
  const focus = async (cookie: string, minutes: number) => {
    const session = await startSession(cookie, minutes);
    clock.advanceMinutes(minutes);
    return (await call(cookie, 'POST', `/api/sessions/${session.id}/complete`)).json();
  };

  it('builds over consecutive days, pays a bonus from day 2, and survives a short day', async () => {
    clock.set('2030-07-01T09:00:00Z');
    const cookie = await newUser();

    const day1 = await focus(cookie, 60);
    expect(day1).toMatchObject({ streak: 1, pointsAwarded: 10 });

    clock.set('2030-07-02T09:00:00Z');
    const day2 = await focus(cookie, 60);
    expect(day2).toMatchObject({ streak: 2, pointsAwarded: 10 + 20 });

    // Day 3: only a short session. The streak must still be alive (the old client reset it here).
    clock.set('2030-07-03T09:00:00Z');
    const short = await focus(cookie, 25);
    expect(short.streak).toBe(2);
    const afterShort = (await call(cookie, 'GET', '/api/sessions/streak')).json();
    expect(afterShort).toMatchObject({ currentStreak: 2, goalReachedToday: false });

    const more = await focus(cookie, 45);
    expect(more).toMatchObject({ streak: 3, todayMinutes: 70 });
    expect(more.pointsAwarded).toBe(10 + 30);
  });

  it('adds the bonus only once per day', async () => {
    clock.set('2030-08-01T09:00:00Z');
    const cookie = await newUser();
    await focus(cookie, 60);
    clock.set('2030-08-02T09:00:00Z');
    expect((await focus(cookie, 60)).pointsAwarded).toBe(30);
    expect((await focus(cookie, 15)).pointsAwarded).toBe(10);
  });

  it('resets after a missed day', async () => {
    clock.set('2030-09-01T09:00:00Z');
    const cookie = await newUser();
    await focus(cookie, 60);
    clock.set('2030-09-04T09:00:00Z');
    expect((await call(cookie, 'GET', '/api/sessions/streak')).json().currentStreak).toBe(0);
    expect((await focus(cookie, 60)).streak).toBe(1);
  });

  it("counts days in the user's own time zone", async () => {
    // 20:30 UTC on Jul 1 is already Jul 2 in Ho Chi Minh City.
    clock.set('2030-10-01T20:30:00Z');
    const cookie = await newUser({ timezone: 'Asia/Ho_Chi_Minh' });
    await focus(cookie, 60);
    clock.set('2030-10-02T20:30:00Z');
    expect((await focus(cookie, 60)).streak).toBe(2);
  });
});

describe('gacha', () => {
  const earn = async (cookie: string, points: number) => {
    // q1 = 15 points each.
    for (let i = 0; i < points / 15; i++) {
      const { id } = (
        await call(cookie, 'POST', '/api/tasks', { title: 'earn', quadrant: 'q1' })
      ).json();
      await call(cookie, 'POST', `/api/tasks/${id}/complete`);
    }
  };

  it('refuses a pull without enough points', async () => {
    const cookie = await newUser();
    await earn(cookie, 15);
    const res = await call(cookie, 'POST', '/api/rewards/gacha');
    expect(res.statusCode).toBe(402);
    expect(res.json()).toMatchObject({ balance: 15, cost: 30 });
  });

  it('spends 30 points and adds the reward to the inventory', async () => {
    const cookie = await newUser();
    await earn(cookie, 60);
    const res = await call(cookie, 'POST', '/api/rewards/gacha');
    expect(res.statusCode).toBe(200);
    expect(res.json().balance).toBe(30);
    const inventory = (await call(cookie, 'GET', '/api/rewards/inventory')).json();
    expect(inventory).toHaveLength(1);
    expect(inventory[0].rewardId).toBe(res.json().reward.id);
    expect(await balance(cookie)).toBe(30);
  });

  it('cannot be double-spent by parallel pulls', async () => {
    const cookie = await newUser();
    await earn(cookie, 30);
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => call(cookie, 'POST', '/api/rewards/gacha')),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 402)).toHaveLength(3);
    expect(await balance(cookie)).toBe(0);
  });

  it('keeps a history of every point movement', async () => {
    const cookie = await newUser();
    await earn(cookie, 30);
    await call(cookie, 'POST', '/api/rewards/gacha');
    const { history } = (await call(cookie, 'GET', '/api/points')).json();
    expect(history.map((h: { reason: string }) => h.reason).sort()).toEqual([
      'gacha_spend',
      'task_complete',
      'task_complete',
    ]);
    expect(history.reduce((sum: number, h: { amount: number }) => sum + h.amount, 0)).toBe(0);
  });

  it('exposes the catalogue', async () => {
    const cookie = await newUser();
    const res = (await call(cookie, 'GET', '/api/rewards/catalog')).json();
    expect(res.cost).toBe(30);
    expect(res.rewards).toHaveLength(8);
  });
});

describe('profile', () => {
  it('rejects unknown time zones and lets the user change theirs', async () => {
    const cookie = await newUser();
    expect(
      (await call(cookie, 'PATCH', '/api/auth/me', { timezone: 'Mars/Olympus' })).statusCode,
    ).toBe(400);
    const ok = await call(cookie, 'PATCH', '/api/auth/me', { timezone: 'Asia/Tokyo' });
    expect(ok.json().timezone).toBe('Asia/Tokyo');
  });
});
