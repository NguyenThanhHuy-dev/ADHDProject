import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { COOKIE_NAME } from '../constants';
import { users, type User } from '../db/schema';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});

const timezone = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Unknown IANA time zone' },
);

const registerBody = credentials.extend({
  displayName: z.string().trim().min(1).max(60).optional(),
  timezone: timezone.optional(),
});

const profileBody = z
  .object({ displayName: z.string().trim().min(1).max(60), timezone })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  timezone: u.timezone,
});

// Verified against when the email is unknown, so login takes similar time either way.
const DUMMY_HASH = await argon2.hash('not-a-real-password');

export const authRoutes: FastifyPluginAsync = async (app) => {
  const setSession = (reply: FastifyReply, userId: string) => {
    const token = app.jwt.sign({ sub: userId }, { expiresIn: '7d' });
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: app.config.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  };

  // Brute-force guard. Tests create dozens of users from one address, so they are exempt.
  const limit = {
    config: {
      rateLimit: { max: app.config.NODE_ENV === 'test' ? 10_000 : 10, timeWindow: '1 minute' },
    },
  };

  app.post('/register', limit, async (request, reply) => {
    const body = registerBody.parse(request.body);
    const [existing] = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email));
    if (existing) return reply.status(409).send({ error: 'Email is already registered' });

    const [user] = await app.db
      .insert(users)
      .values({
        email: body.email,
        passwordHash: await argon2.hash(body.password),
        displayName: body.displayName ?? body.email.split('@')[0],
        timezone: body.timezone ?? 'UTC',
      })
      .returning();
    setSession(reply, user.id);
    return reply.status(201).send(publicUser(user));
  });

  app.post('/login', limit, async (request, reply) => {
    const body = credentials.parse(request.body);
    const [user] = await app.db.select().from(users).where(eq(users.email, body.email));
    const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, body.password);
    if (!user || !ok) return reply.status(401).send({ error: 'Invalid email or password' });
    setSession(reply, user.id);
    return publicUser(user);
  });

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: app.authenticate }, async (request, reply) => {
    const [user] = await app.db.select().from(users).where(eq(users.id, request.user.sub));
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    return publicUser(user);
  });

  app.patch('/me', { preHandler: app.authenticate }, async (request, reply) => {
    const body = profileBody.parse(request.body);
    const [user] = await app.db
      .update(users)
      .set(body)
      .where(eq(users.id, request.user.sub))
      .returning();
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    return publicUser(user);
  });
};
