import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyRequest } from 'fastify';
import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import type { Config } from './config';
import { COOKIE_NAME } from './constants';
import type { Db } from './db/types';
import { randomInt } from 'node:crypto';
import { authRoutes } from './routes/auth';
import { importRoutes } from './routes/import';
import { pointRoutes } from './routes/points';
import { pushRoutes } from './routes/push';
import { rewardRoutes } from './routes/rewards';
import { sessionRoutes } from './routes/sessions';
import { statsRoutes } from './routes/stats';
import { stepRoutes } from './routes/steps';
import type { StepSuggester } from './services/ai';
import type { PushSender } from './services/push';
import { taskRoutes } from './routes/tasks';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN' | 'JWT_SECRET' | 'TRUST_PROXY'>;
    authenticate: (request: FastifyRequest) => Promise<void>;
    /** Injected so tests can control time and randomness. */
    now: () => Date;
    random: () => number;
    /** Null when no AI provider is configured. */
    suggester: StepSuggester | null;
    /** Null when VAPID keys are not configured. */
    pushSender: PushSender | null;
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
  suggester?: StepSuggester | null;
  pushSender?: PushSender | null;
}

const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

export const buildApp = async (
  db: Db,
  config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN' | 'JWT_SECRET' | 'TRUST_PROXY'>,
  deps: AppDeps = {},
) => {
  const app = Fastify({
    logger: config.NODE_ENV === 'development',
    // Behind nginx or a load balancer the client address comes from X-Forwarded-For.
    trustProxy: config.TRUST_PROXY,
  });

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('now', deps.now ?? (() => new Date()));
  app.decorate('random', deps.random ?? secureRandom);
  app.decorate('suggester', deps.suggester ?? null);
  app.decorate('pushSender', deps.pushSender ?? null);

  await app.register(helmet);
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

  // Lets the web app hide features this server cannot provide.
  app.get('/api/features', async () => ({
    aiSteps: app.suggester !== null,
    push: app.pushSender !== null,
  }));

  app.get('/api/health', async (_request, reply) => {
    try {
      await app.db.execute(sql`select 1`);
      return { status: 'ok', db: 'up' };
    } catch {
      return reply.status(503).send({ status: 'degraded', db: 'down' });
    }
  });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(stepRoutes, { prefix: '/api/tasks/:taskId/steps' });
  await app.register(sessionRoutes, { prefix: '/api/sessions' });
  await app.register(pointRoutes, { prefix: '/api/points' });
  await app.register(rewardRoutes, { prefix: '/api/rewards' });
  await app.register(importRoutes, { prefix: '/api/import' });
  await app.register(pushRoutes, { prefix: '/api/push' });
  await app.register(statsRoutes, { prefix: '/api/stats' });

  return app;
};
