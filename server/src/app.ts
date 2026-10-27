import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Config } from './config';
import { COOKIE_NAME } from './constants';
import type { Db } from './db/types';
import { randomInt } from 'node:crypto';
import { authRoutes } from './routes/auth';
import { importRoutes } from './routes/import';
import { pointRoutes } from './routes/points';
import { rewardRoutes } from './routes/rewards';
import { sessionRoutes } from './routes/sessions';
import { taskRoutes } from './routes/tasks';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN' | 'JWT_SECRET'>;
    authenticate: (request: FastifyRequest) => Promise<void>;
    /** Injected so tests can control time and randomness. */
    now: () => Date;
    random: () => number;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export interface AppDeps {
  now?: () => Date;
  random?: () => number;
}

const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

export const buildApp = async (
  db: Db,
  config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN' | 'JWT_SECRET'>,
  deps: AppDeps = {},
) => {
  const app = Fastify({ logger: config.NODE_ENV === 'development' });

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('now', deps.now ?? (() => new Date()));
  app.decorate('random', deps.random ?? secureRandom);

  await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: COOKIE_NAME, signed: false },
  });
  await app.register(rateLimit, { global: false });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    await request.jwtVerify({ onlyCookie: true });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'validation_error', issues: error.issues });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(error);
    const message = status >= 500 ? 'Internal server error' : (error as Error).message;
    return reply.status(status).send({ error: message });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(sessionRoutes, { prefix: '/api/sessions' });
  await app.register(pointRoutes, { prefix: '/api/points' });
  await app.register(rewardRoutes, { prefix: '/api/rewards' });
  await app.register(importRoutes, { prefix: '/api/import' });

  return app;
};
