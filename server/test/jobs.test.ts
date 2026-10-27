import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { pointLedger, users } from '../src/db/schema';
import { runScheduledJobs } from '../src/jobs/overdue';
import { createTestApp, makeClock, registerUser, type TestApp } from './helpers';

const clock = makeClock('2030-06-10T09:00:00Z');
let app: TestApp;
let close: () => Promise<void>;
let seq = 0;

beforeAll(async () => {
  ({ app, close } = await createTestApp({ now: clock.now }));
});
afterAll(() => close());

const newUser = async () => {
  const email = `job${++seq}@example.com`;
  const { cookie } = await registerUser(app, email);
  const [{ id }] = await app.db.select({ id: users.id }).from(users).where(eq(users.email, email));
  return { cookie, id };
};
const call = (cookie: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, payload });
const createTask = async (cookie: string, quadrant: string, dueInHours: number | null) =>
  (
    await call(cookie, 'POST', '/api/tasks', {
      title: `task ${++seq}`,
      quadrant,
      dueAt:
        dueInHours === null
          ? null
          : new Date(clock.now().getTime() + dueInHours * 3_600_000).toISOString(),
    })
  ).json();
const balance = async (cookie: string) => (await call(cookie, 'GET', '/api/points')).json().balance;
const ledger = (userId: string) =>
  app.db
    .select()
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, 'task_overdue')));
const runJobs = () => runScheduledJobs(app.db, clock.now());

describe('overdue penalty job', () => {
  it('charges the quadrant points once the due date has passed', async () => {
    const { cookie, id } = await newUser();
    const earn = await createTask(cookie, 'q1', null);
    await call(cookie, 'POST', `/api/tasks/${earn.id}/complete`); // +15
    await createTask(cookie, 'q2', 2);

    clock.advanceMinutes(60);
    await runJobs();
    expect(await balance(cookie)).toBe(15); // not due yet

    clock.advanceMinutes(120);
    const result = await runJobs();
    expect(result).toMatchObject({ skipped: false, overdue: { penalized: 1, points: 10 } });
    expect(await balance(cookie)).toBe(5);
    expect((await ledger(id)).map((r) => r.amount)).toEqual([-10]);
  });

  it('is idempotent: running again charges nothing more', async () => {
    const { cookie } = await newUser();
    const earn = await createTask(cookie, 'q1', null);
    await call(cookie, 'POST', `/api/tasks/${earn.id}/complete`);
    await createTask(cookie, 'q3', 1);
    clock.advanceMinutes(120);
    await runJobs();
    const again = await runJobs();
    expect(again).toMatchObject({ overdue: { penalized: 0, points: 0 } });
    expect(await balance(cookie)).toBe(10);
  });

  it('never takes a balance below zero and does not charge retroactively later', async () => {
    const { cookie, id } = await newUser();
    const first = await createTask(cookie, 'q1', 1);
    clock.advanceMinutes(120);
    await runJobs();
    expect(await balance(cookie)).toBe(0);
    expect((await ledger(id)).map((r) => r.amount)).toEqual([0]);

    // Points earned afterwards are not touched by the old, already-processed task.
    const earn = await createTask(cookie, 'q1', null);
    await call(cookie, 'POST', `/api/tasks/${earn.id}/complete`);
    await runJobs();
    expect(await balance(cookie)).toBe(15);
    expect(first.id).toBeTruthy();
  });

  it('leaves completed tasks and tasks without a due date alone', async () => {
    const { cookie } = await newUser();
    const done = await createTask(cookie, 'q1', 1);
    await call(cookie, 'POST', `/api/tasks/${done.id}/complete`); // +15, finished on time
    await createTask(cookie, 'q2', null);
    clock.advanceDays(30);
    const result = await runJobs();
    expect(result).toMatchObject({ overdue: { penalized: 0 } });
    expect(await balance(cookie)).toBe(15);
  });
});

describe('due date validation', () => {
  it('rejects a due date in the past on create and when it is changed', async () => {
    const { cookie } = await newUser();
    const past = new Date(clock.now().getTime() - 3_600_000).toISOString();
    expect(
      (await call(cookie, 'POST', '/api/tasks', { title: 'x', quadrant: 'q1', dueAt: past }))
        .statusCode,
    ).toBe(400);

    const task = await createTask(cookie, 'q1', 1);
    expect((await call(cookie, 'PATCH', `/api/tasks/${task.id}`, { dueAt: past })).statusCode).toBe(
      400,
    );
  });

  it('lets an overdue task be edited when its due date is re-sent unchanged', async () => {
    const { cookie } = await newUser();
    const task = await createTask(cookie, 'q1', 1);
    clock.advanceMinutes(180);
    const res = await call(cookie, 'PATCH', `/api/tasks/${task.id}`, {
      title: 'renamed',
      dueAt: task.dueAt,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('renamed');
  });
});

describe('recurring tasks', () => {
  const complete = async (cookie: string, id: string) =>
    (await call(cookie, 'POST', `/api/tasks/${id}/complete`)).json();
  const create = async (cookie: string, payload: object) =>
    (
      await call(cookie, 'POST', '/api/tasks', {
        title: 'Standup notes',
        quadrant: 'q2',
        ...payload,
      })
    ).json();

  it('creates the next daily task at the same local time, and only once', async () => {
    const { cookie } = await newUser();
    // 16:59 UTC = 23:59 in Ho Chi Minh City.
    await call(cookie, 'PATCH', '/api/auth/me', { timezone: 'Asia/Ho_Chi_Minh' });
    clock.set('2030-07-01T01:00:00Z');
    const task = await create(cookie, { recurrence: 'daily', dueAt: '2030-07-01T16:59:00Z' });

    const first = await complete(cookie, task.id);
    expect(first.nextTask).toMatchObject({
      title: 'Standup notes',
      recurrence: 'daily',
      completedAt: null,
    });
    expect(first.nextTask.dueAt).toBe('2030-07-02T16:59:00.000Z');

    const second = await complete(cookie, task.id);
    expect(second.nextTask).toBeNull();
    const open = (await call(cookie, 'GET', '/api/tasks?status=open')).json();
    expect(open.filter((t: { title: string }) => t.title === 'Standup notes')).toHaveLength(1);
  });

  it('skips past occurrences that were missed', async () => {
    const { cookie } = await newUser();
    clock.set('2030-07-01T01:00:00Z');
    const task = await create(cookie, { recurrence: 'daily', dueAt: '2030-07-01T16:59:00Z' });
    clock.set('2030-07-05T10:00:00Z'); // four days later
    const { nextTask } = await complete(cookie, task.id);
    expect(nextTask.dueAt).toBe('2030-07-05T16:59:00.000Z');
  });

  it('moves weekly tasks by seven days', async () => {
    const { cookie } = await newUser();
    clock.set('2030-07-01T01:00:00Z');
    const task = await create(cookie, { recurrence: 'weekly', dueAt: '2030-07-03T12:00:00Z' });
    expect((await complete(cookie, task.id)).nextTask.dueAt).toBe('2030-07-10T12:00:00.000Z');
  });

  it('keeps the wall-clock time across a daylight-saving change', async () => {
    const { cookie } = await newUser();
    await call(cookie, 'PATCH', '/api/auth/me', { timezone: 'America/New_York' });
    clock.set('2030-03-09T12:00:00Z');
    // 23:59 New York on Mar 9 (EST, UTC-5) = 04:59 UTC on Mar 10. DST starts on Mar 10.
    const task = await create(cookie, { recurrence: 'daily', dueAt: '2030-03-10T04:59:00Z' });
    const { nextTask } = await complete(cookie, task.id);
    // Next day 23:59 is on EDT (UTC-4): 03:59 UTC, one hour earlier in UTC terms.
    expect(nextTask.dueAt).toBe('2030-03-11T03:59:00.000Z');
  });

  it('does not repeat one-off tasks, and repeats undated tasks without a due date', async () => {
    const { cookie } = await newUser();
    const once = await create(cookie, { dueAt: null });
    expect((await complete(cookie, once.id)).nextTask).toBeNull();
    const undated = await create(cookie, { recurrence: 'daily', dueAt: null });
    const { nextTask } = await complete(cookie, undated.id);
    expect(nextTask).toMatchObject({ dueAt: null, recurrence: 'daily' });
  });

  it('each completion of the series pays points', async () => {
    const { cookie } = await newUser();
    const task = await create(cookie, { recurrence: 'daily', dueAt: null });
    const { nextTask } = await complete(cookie, task.id);
    await complete(cookie, nextTask.id);
    expect(await balance(cookie)).toBe(20);
  });
});

describe('health', () => {
  it('reports the database status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'up' });
  });

  it('sets security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
