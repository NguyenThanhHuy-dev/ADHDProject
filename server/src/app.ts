import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Config } from './config';
import { COOKIE_NAME } from './constants';
import type { Db } from './db/types';
import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN' | 'JWT_SECRET'>;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export const buildApp = async (
  db: Db,
  config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN' | 'JWT_SECRET'>,
) => {
  const app = Fastify({ logger: config.NODE_ENV === 'development' });

  app.decorate('db', db);
  app.decorate('config', config);

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

  return app;
};
