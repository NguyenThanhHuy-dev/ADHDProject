import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerUser, type TestApp } from './helpers';

let app: TestApp;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ app, close } = await createTestApp());
});
afterAll(() => close());

describe('auth', () => {
  it('registers a user, sets an httpOnly cookie and never returns the hash', async () => {
    const { res } = await registerUser(app, 'Ada@Example.com');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: 'ada@example.com', displayName: 'ada' });
    expect(res.body).not.toContain('passwordHash');
    const cookie = res.cookies.find((c) => c.name === 'adhd_token');
    expect(cookie?.httpOnly).toBe(true);
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    await registerUser(app, 'dup@example.com');
    const { res } = await registerUser(app, 'DUP@example.com');
    expect(res.statusCode).toBe(409);
  });

  it('validates input', async () => {
    const short = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'a@b.co', password: 'short' },
    });
    expect(short.statusCode).toBe(400);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', password: 'password123' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('logs in with the right password only', async () => {
    await registerUser(app, 'login@example.com', 'correct-horse');
    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'login@example.com', password: 'correct-horse' },
    });
    expect(ok.statusCode).toBe(200);
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'login@example.com', password: 'wrong-password' },
    });
    expect(wrong.statusCode).toBe(401);
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'whatever123' },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it('returns the current user for a valid session and 401 without one', async () => {
    const { cookie } = await registerUser(app, 'me@example.com');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('me@example.com');
    const anon = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(anon.statusCode).toBe(401);
    const forged = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: 'adhd_token=forged' },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('logout clears the cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(204);
    expect(res.cookies.find((c) => c.name === 'adhd_token')?.value).toBe('');
  });
});
