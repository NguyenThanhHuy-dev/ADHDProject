import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp, type AppDeps } from '../src/app';
import * as schema from '../src/db/schema';
import type { Db } from '../src/db/types';

export const testConfig = {
  NODE_ENV: 'test' as const,
  CORS_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  TRUST_PROXY: false,
};

export const makeClock = (start = '2030-06-10T09:00:00Z') => {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set: (iso: string) => void (current = new Date(iso)),
    advanceMinutes: (m: number) => void (current = new Date(current.getTime() + m * 60_000)),
    advanceDays: (d: number) => void (current = new Date(current.getTime() + d * 86_400_000)),
  };
};

export const createTestApp = async (deps: AppDeps = {}, env: 'test' | 'production' = 'test') => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  const app = await buildApp(db as unknown as Db, { ...testConfig, NODE_ENV: env }, deps);
  return {
    app,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
};

export type TestApp = Awaited<ReturnType<typeof createTestApp>>['app'];

/** Registers a user and returns the session cookie header value. */
export const registerUser = async (
  app: TestApp,
  email: string,
  password = 'password123',
  extra: object = {},
) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, ...extra },
  });
  const cookie = res.cookies.find((c) => c.name === 'adhd_token');
  return { res, cookie: cookie ? `adhd_token=${cookie.value}` : '' };
};
