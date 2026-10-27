import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { tasks } from '../db/schema';

const quadrant = z.enum(['q1', 'q2', 'q3', 'q4']);

const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  quadrant,
  dueAt: z.coerce.date().nullable(),
};

const createBody = z.object({
  ...fields,
  description: fields.description.default(''),
  dueAt: fields.dueAt.default(null),
});

// No defaults here: a partial update must only touch the fields that were sent.
const updateBody = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const idParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({ status: z.enum(['open', 'done']).optional() });

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const owned = (id: string, userId: string) => and(eq(tasks.id, id), eq(tasks.userId, userId));

  app.get('/', async (request) => {
    const { status } = listQuery.parse(request.query);
    const filter =
      status === 'open'
        ? isNull(tasks.completedAt)
        : status === 'done'
          ? isNotNull(tasks.completedAt)
          : undefined;
    return app.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, request.user.sub), filter))
      .orderBy(desc(tasks.createdAt));
  });

  app.post('/', async (request, reply) => {
    const body = createBody.parse(request.body);
    const [task] = await app.db
      .insert(tasks)
      .values({ ...body, userId: request.user.sub })
      .returning();
    return reply.status(201).send(task);
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = updateBody.parse(request.body);
    const [task] = await app.db
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(owned(id, request.user.sub))
      .returning();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return task;
  });

  // Idempotent: completing a finished task keeps the original completion time.
  app.post('/:id/complete', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [updated] = await app.db
      .update(tasks)
      .set({ completedAt: new Date(), updatedAt: new Date() })
      .where(and(owned(id, request.user.sub), isNull(tasks.completedAt)))
      .returning();
    if (updated) return updated;
    const [existing] = await app.db.select().from(tasks).where(owned(id, request.user.sub));
    if (!existing) return reply.status(404).send({ error: 'Task not found' });
    return existing;
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const deleted = await app.db
      .delete(tasks)
      .where(owned(id, request.user.sub))
      .returning({ id: tasks.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Task not found' });
    return reply.status(204).send();
  });
};
