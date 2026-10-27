import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../src/app';
import * as schema from '../src/db/schema';
import type { Db } from '../src/db/types';

export const testConfig = {
  NODE_ENV: 'test' as const,
  CORS_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
};

export const createTestApp = async () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  const app = await buildApp(db as unknown as Db, testConfig);
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
export const registerUser = async (app: TestApp, email: string, password = 'password123') => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password },
  });
  const cookie = res.cookies.find((c) => c.name === 'adhd_token');
  return { res, cookie: cookie ? `adhd_token=${cookie.value}` : '' };
};
