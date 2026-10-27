import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { tasks } from '../db/schema';

const quadrant = z.enum(['q1', 'q2', 'q3', 'q4']);

const body = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).default(''),
        quadrant,
        dueAt: z.coerce.date().nullable().default(null),
        completedAt: z.coerce.date().nullable().default(null),
        createdAt: z.coerce.date().optional(),
      }),
    )
    .max(500),
});

/**
 * Moves tasks created before accounts existed (localStorage) into the user's account.
 * It never touches points or rewards: those only come from server-verified activity.
 */
export const importRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.post('/', async (request, reply) => {
    const { tasks: incoming } = body.parse(request.body);
    if (incoming.length === 0) return { imported: 0 };
    const rows = await app.db
      .insert(tasks)
      .values(incoming.map((t) => ({ ...t, userId: request.user.sub })))
      .returning({ id: tasks.id });
    return reply.status(201).send({ imported: rows.length });
  });
};
