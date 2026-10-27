import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { pomodoroSessions, pushSubscriptions, users } from '../src/db/schema';
import { runScheduledJobs } from '../src/jobs/overdue';
import {
  createWebPushSender,
  type PushPayload,
  type PushResult,
  type PushSender,
} from '../src/services/push';
import { createTestApp, makeClock, registerUser, type TestApp } from './helpers';

const clock = makeClock('2030-06-10T09:00:00Z');
const send = vi.fn<(endpoint: string, payload: PushPayload) => PushResult>(() => 'sent');
const sender: PushSender = {
  publicKey: 'test-public-key',
  send: async (target, payload) => send(target.endpoint, payload),
};

let app: TestApp;
let close: () => Promise<void>;
let seq = 0;

beforeAll(async () => {
  ({ app, close } = await createTestApp({ now: clock.now, pushSender: sender }));
});
afterAll(() => close());

const newUser = async () => {
  const email = `push${++seq}@example.com`;
  const { cookie } = await registerUser(app, email);
  const [{ id }] = await app.db.select({ id: users.id }).from(users).where(eq(users.email, email));
  return { cookie, id };
};
const call = (
  cookie: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) => app.inject({ method, url, headers: { cookie }, payload });
const subscribe = (cookie: string, n = 1) =>
  call(cookie, 'POST', '/api/push/subscribe', {
    endpoint: `https://push.example.test/send/${seq}-${n}`,
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
  });
const runJobs = () => runScheduledJobs(app.db, clock.now(), sender);
const task = async (cookie: string, hoursFromNow: number | null, title = `task ${++seq}`) =>
  (
    await call(cookie, 'POST', '/api/tasks', {
      title,
      quadrant: 'q2',
      dueAt:
        hoursFromNow === null
          ? null
          : new Date(clock.now().getTime() + hoursFromNow * 3_600_000).toISOString(),
    })
  ).json();

describe('subscriptions API', () => {
  it('exposes the public key and the feature flag', async () => {
    const { cookie } = await newUser();
    expect((await call(cookie, 'GET', '/api/push/public-key')).json()).toEqual({
      publicKey: 'test-public-key',
    });
    expect((await app.inject({ method: 'GET', url: '/api/features' })).json()).toMatchObject({
      push: true,
    });
  });

  it('stores a subscription, moves it to the next user on the same browser, and removes it', async () => {
    const a = await newUser();
    const endpoint = 'https://push.example.test/send/shared-browser';
    const keys = { p256dh: 'k1', auth: 'a1' };
    expect(
      (await call(a.cookie, 'POST', '/api/push/subscribe', { endpoint, keys })).statusCode,
    ).toBe(204);
    expect((await call(a.cookie, 'GET', '/api/push/settings')).json()).toMatchObject({
      subscriptions: 1,
    });

    const b = await newUser();
    await call(b.cookie, 'POST', '/api/push/subscribe', {
      endpoint,
      keys: { p256dh: 'k2', auth: 'a2' },
    });
    expect((await call(a.cookie, 'GET', '/api/push/settings')).json()).toMatchObject({
      subscriptions: 0,
    });
    expect((await call(b.cookie, 'GET', '/api/push/settings')).json()).toMatchObject({
      subscriptions: 1,
    });

    // Only the owner can remove it.
    await call(a.cookie, 'DELETE', '/api/push/subscribe', { endpoint });
    expect((await call(b.cookie, 'GET', '/api/push/settings')).json()).toMatchObject({
      subscriptions: 1,
    });
    expect((await call(b.cookie, 'DELETE', '/api/push/subscribe', { endpoint })).statusCode).toBe(
      204,
    );
    expect((await call(b.cookie, 'GET', '/api/push/settings')).json()).toMatchObject({
      subscriptions: 0,
    });
  });

  it('rejects non-HTTPS endpoints and malformed bodies', async () => {
    const { cookie } = await newUser();
    const keys = { p256dh: 'k', auth: 'a' };
    for (const endpoint of [
      'http://push.example.test/x',
      'http://169.254.169.254/latest',
      'not a url',
    ]) {
      expect(
        (await call(cookie, 'POST', '/api/push/subscribe', { endpoint, keys })).statusCode,
      ).toBe(400);
    }
    expect(
      (await call(cookie, 'POST', '/api/push/subscribe', { endpoint: 'https://x.test/a' }))
        .statusCode,
    ).toBe(400);
  });

  it('keeps at most 10 subscriptions per user, dropping the oldest', async () => {
    const { cookie, id } = await newUser();
    for (let i = 0; i < 12; i++) await subscribe(cookie, i);
    const rows = await app.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, id));
    expect(rows).toHaveLength(10);
    expect(rows.some((r) => r.endpoint.endsWith('-0'))).toBe(false);
  });

  it('requires login and reads/updates the notification settings', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/api/push/subscribe', payload: {} })).statusCode,
    ).toBe(401);
    const { cookie } = await newUser();
    expect((await call(cookie, 'GET', '/api/push/settings')).json()).toMatchObject({
      available: true,
      dueReminders: true,
      timerEnd: true,
    });
    const res = await call(cookie, 'PATCH', '/api/push/settings', { timerEnd: false });
    expect(res.json()).toEqual({ dueReminders: true, timerEnd: false });
    expect((await call(cookie, 'PATCH', '/api/push/settings', {})).statusCode).toBe(400);
  });

  it('sends a test notification to every registered browser', async () => {
    const { cookie } = await newUser();
    await subscribe(cookie, 1);
    await subscribe(cookie, 2);
    send.mockClear();
    const res = await call(cookie, 'POST', '/api/push/test');
    expect(res.json()).toEqual({ sent: 2, gone: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('is switched off without VAPID keys', async () => {
    const bare = await createTestApp();
    const cookie = (await registerUser(bare.app, 'nopush@example.com')).cookie;
    expect(
      (await bare.app.inject({ method: 'GET', url: '/api/push/public-key', headers: { cookie } }))
        .statusCode,
    ).toBe(503);
    expect((await bare.app.inject({ method: 'GET', url: '/api/features' })).json()).toMatchObject({
      push: false,
    });
    await bare.close();
  });
});

describe('due-soon reminders', () => {
  it('reminds once for a task due within the hour, only for users with a subscription', async () => {
    const { cookie } = await newUser();
    const quiet = await newUser(); // no subscription
    await subscribe(cookie);
    const soon = await task(cookie, 0.5, 'Send the invoice');
    await task(cookie, 5, 'Later this evening');
    await task(quiet.cookie, 0.5, 'Nobody to tell');

    send.mockClear();
    const first = await runJobs();
    expect(first).toMatchObject({ skipped: false, notifications: { claimed: 1, sent: 1 } });
    expect(send).toHaveBeenCalledTimes(1);
    const [, payload] = send.mock.calls[0];
    expect(payload).toMatchObject({
      title: 'Task due soon',
      url: '/tasks',
      tag: `task-${soon.id}`,
    });
    expect(payload.body).toContain('Send the invoice');
    expect(payload.body).toMatch(/in 30 min/);

    send.mockClear();
    await runJobs(); // again: nothing new
    expect(send).not.toHaveBeenCalled();
  });

  it('does not remind for finished tasks, overdue tasks, tasks without a due date, or when switched off', async () => {
    const { cookie } = await newUser();
    await subscribe(cookie);
    const done = await task(cookie, 0.5);
    await call(cookie, 'POST', `/api/tasks/${done.id}/complete`);
    await task(cookie, null);
    await call(cookie, 'PATCH', '/api/push/settings', { dueReminders: false });
    await task(cookie, 0.4);
    send.mockClear();
    await runJobs();
    expect(send).not.toHaveBeenCalled();
  });

  it('a changed due date earns a fresh reminder', async () => {
    const { cookie } = await newUser();
    await subscribe(cookie);
    const t = await task(cookie, 0.5);
    await runJobs();
    clock.advanceMinutes(10);
    const later = new Date(clock.now().getTime() + 30 * 60_000).toISOString();
    await call(cookie, 'PATCH', `/api/tasks/${t.id}`, { dueAt: later });
    send.mockClear();
    await runJobs();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('removes subscriptions the push service says are gone', async () => {
    const { cookie, id } = await newUser();
    await subscribe(cookie);
    await task(cookie, 0.5);
    send.mockReturnValueOnce('gone');
    await runJobs();
    expect(
      await app.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, id)),
    ).toHaveLength(0);
  });

  it('does not repeat a reminder when delivery fails (at most once)', async () => {
    const { cookie } = await newUser();
    await subscribe(cookie);
    await task(cookie, 0.5);
    send.mockReturnValueOnce('failed');
    expect(await runJobs()).toMatchObject({ notifications: { claimed: 1, failed: 1 } });
    send.mockClear();
    await runJobs();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('focus session alerts', () => {
  const start = async (cookie: string, minutes: number) =>
    (await call(cookie, 'POST', '/api/sessions/start', { plannedMinutes: minutes })).json();

  it('alerts when the planned time has passed, once, and not before', async () => {
    const { cookie } = await newUser();
    await subscribe(cookie);
    await start(cookie, 25);
    send.mockClear();
    clock.advanceMinutes(24);
    await runJobs();
    expect(send).not.toHaveBeenCalled();

    clock.advanceMinutes(2);
    await runJobs();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toMatchObject({
      title: 'Focus session done',
      url: '/pomodoro',
      skipIfFocused: true,
    });

    await runJobs();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for cancelled sessions, stale sessions and users who turned it off', async () => {
    const a = await newUser();
    await subscribe(a.cookie);
    const s = await start(a.cookie, 15);
    await call(a.cookie, 'POST', `/api/sessions/${s.id}/cancel`);

    const b = await newUser();
    await subscribe(b.cookie);
    await call(b.cookie, 'PATCH', '/api/push/settings', { timerEnd: false });
    await start(b.cookie, 15);

    const c = await newUser();
    await subscribe(c.cookie);
    await start(c.cookie, 15);
    await app.db
      .update(pomodoroSessions)
      .set({ startedAt: new Date(clock.now().getTime() - 10 * 3_600_000) })
      .where(eq(pomodoroSessions.userId, c.id));

    send.mockClear();
    clock.advanceMinutes(30);
    await runJobs();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('real Web Push delivery', () => {
  // web-push only speaks HTTPS, so the throwaway "push service" gets a one-off self-signed certificate.
  const dir = mkdtempSync(join(tmpdir(), 'push-test-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:prime256v1',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-keyout',
      join(dir, 'key.pem'),
      '-out',
      join(dir, 'cert.pem'),
    ],
    { stdio: 'ignore' },
  );
  const tls = {
    key: readFileSync(join(dir, 'key.pem')),
    cert: readFileSync(join(dir, 'cert.pem')),
  };
  const previousTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  beforeAll(() => void (process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'));
  afterAll(() => {
    if (previousTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTls;
  });

  const receive = async (status: number) => {
    const seen: { headers: IncomingMessage['headers']; bytes: number }[] = [];
    const server = createServer(tls, (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        seen.push({ headers: req.headers, bytes: Buffer.concat(chunks).length });
        res.statusCode = status;
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    return {
      seen,
      url: `https://127.0.0.1:${port}/push`,
      stop: () => new Promise((r) => server.close(r)),
    };
  };

  const subscriber = () => {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    return {
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    };
  };

  const vapid = webpush.generateVAPIDKeys();
  const real = createWebPushSender({ ...vapid, subject: 'mailto:test@example.com' });
  const payload: PushPayload = { title: 'Hi', body: 'There', tag: 't', url: '/tasks' };

  it('posts an encrypted, VAPID-signed message to the subscription endpoint', async () => {
    const push = await receive(201);
    const result = await real.send({ endpoint: push.url, ...subscriber() }, payload);
    await push.stop();
    expect(result).toBe('sent');
    expect(push.seen).toHaveLength(1);
    const { headers, bytes } = push.seen[0];
    expect(headers['content-encoding']).toBe('aes128gcm');
    expect(headers.authorization).toMatch(/^vapid t=/);
    expect(headers.authorization).toContain(`k=${vapid.publicKey}`);
    expect(headers.ttl).toBe('3600');
    expect(bytes).toBeGreaterThan(40); // encrypted, not the JSON in the clear
  });

  it('reports 410 and 404 as gone and other errors as failed', async () => {
    for (const [status, expected] of [
      [410, 'gone'],
      [404, 'gone'],
      [500, 'failed'],
      [429, 'failed'],
    ] as const) {
      const push = await receive(status);
      expect(await real.send({ endpoint: push.url, ...subscriber() }, payload)).toBe(expected);
      await push.stop();
    }
  });

  it('reports a failure, not a crash, when the endpoint is unreachable', async () => {
    expect(
      await real.send({ endpoint: 'https://127.0.0.1:1/push', ...subscriber() }, payload),
    ).toBe('failed');
  });
});
