import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pushSubscriptions, users } from '../db/schema';
import { sendToUser } from '../jobs/reminders';

const MAX_SUBSCRIPTIONS_PER_USER = 10;

const subscribeBody = z.object({
  // Push services are always HTTPS; refusing anything else also keeps the server from being pointed at internal hosts.
  endpoint: z.string().url().max(2048).startsWith('https://'),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});
const unsubscribeBody = z.object({ endpoint: z.string().url().max(2048) });
const settingsBody = z
  .object({ dueReminders: z.boolean(), timerEnd: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const pushRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const requireSender = () => {
    if (!app.pushSender)
      throw Object.assign(new Error('Push notifications are not configured on this server'), {
        statusCode: 503,
      });
    return app.pushSender;
  };

  app.get('/public-key', async () => ({ publicKey: requireSender().publicKey }));

  app.get('/settings', async (request) => {
    const userId = request.user.sub;
    const [user] = await app.db
      .select({ dueReminders: users.notifyDueReminders, timerEnd: users.notifyTimerEnd })
      .from(users)
      .where(eq(users.id, userId));
    const [{ count }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return { available: app.pushSender !== null, subscriptions: count, ...user };
  });

  app.patch('/settings', async (request, reply) => {
    const body = settingsBody.parse(request.body);
    const [user] = await app.db
      .update(users)
      .set({
        ...(body.dueReminders !== undefined && { notifyDueReminders: body.dueReminders }),
        ...(body.timerEnd !== undefined && { notifyTimerEnd: body.timerEnd }),
      })
      .where(eq(users.id, request.user.sub))
      .returning({ dueReminders: users.notifyDueReminders, timerEnd: users.notifyTimerEnd });
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    return user;
  });

  app.post('/subscribe', async (request, reply) => {
    requireSender();
    const { endpoint, keys } = subscribeBody.parse(request.body);
    const userId = request.user.sub;
    await app.db.transaction(async (tx) => {
      await tx
        .insert(pushSubscriptions)
        .values({
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: String(request.headers['user-agent'] ?? '').slice(0, 200) || null,
        })
        // The same browser signing in as someone else takes the subscription over.
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { userId, p256dh: keys.p256dh, auth: keys.auth },
        });
      const mine = await tx
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId))
        .orderBy(asc(pushSubscriptions.createdAt));
      for (const old of mine.slice(0, Math.max(0, mine.length - MAX_SUBSCRIPTIONS_PER_USER))) {
        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, old.id));
      }
    });
    return reply.status(204).send();
  });

  app.delete('/subscribe', async (request, reply) => {
    const { endpoint } = unsubscribeBody.parse(request.body);
    await app.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, request.user.sub),
        ),
      );
    return reply.status(204).send();
  });

  app.post(
    '/test',
    {
      config: {
        rateLimit: { max: app.config.NODE_ENV === 'test' ? 10_000 : 5, timeWindow: '1 minute' },
      },
    },
    async (request) => {
      const sender = requireSender();
      return sendToUser(app.db, sender, request.user.sub, {
        title: 'Notifications are on',
        body: 'You will get reminders for tasks that are due soon and when a focus session ends.',
        tag: 'test',
        url: '/settings',
      });
    },
  );
};
