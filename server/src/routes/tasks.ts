import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { tasks, users } from '../db/schema';
import { award, QUADRANT_POINTS } from '../domain/points';
import { nextDueAt } from '../domain/recurrence';
import { stepsByTask } from '../domain/steps';

const quadrant = z.enum(['q1', 'q2', 'q3', 'q4']);
const recurrence = z.enum(['none', 'daily', 'weekly']);

const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  quadrant,
  recurrence,
  dueAt: z.coerce.date().nullable(),
};

const createBody = z.object({
  ...fields,
  description: fields.description.default(''),
  recurrence: fields.recurrence.default('none'),
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
    const rows = await app.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, request.user.sub), filter))
      .orderBy(desc(tasks.createdAt));
    const steps = await stepsByTask(
      app.db,
      request.user.sub,
      rows.map((t) => t.id),
    );
    return rows.map((t) => ({ ...t, steps: steps.get(t.id) ?? [] }));
  });

  app.post('/', async (request, reply) => {
    const body = createBody.parse(request.body);
    if (body.dueAt && body.dueAt < app.now()) {
      return reply.status(400).send({ error: 'Due date is in the past' });
    }
    const [task] = await app.db
      .insert(tasks)
      .values({ ...body, userId: request.user.sub })
      .returning();
    return reply.status(201).send({ ...task, steps: [] });
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = updateBody.parse(request.body);
    if (body.dueAt) {
      // Editing other fields of an already-overdue task re-sends its old due date: that is fine.
      const [current] = await app.db
        .select({ dueAt: tasks.dueAt })
        .from(tasks)
        .where(owned(id, request.user.sub));
      const unchanged = current?.dueAt?.getTime() === body.dueAt.getTime();
      if (!unchanged && body.dueAt < app.now()) {
        return reply.status(400).send({ error: 'Due date is in the past' });
      }
    }
    const [task] = await app.db
      .update(tasks)
      // A new due date deserves a fresh reminder.
      .set({
        ...body,
        ...(body.dueAt !== undefined && { remindedAt: null }),
        updatedAt: new Date(),
      })
      .where(owned(id, request.user.sub))
      .returning();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    const steps = await stepsByTask(app.db, request.user.sub, [task.id]);
    return { ...task, steps: steps.get(task.id) ?? [] };
  });

  // Idempotent: completing a finished task keeps the original completion time and pays out only once.
  app.post('/:id/complete', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const userId = request.user.sub;
    const result = await app.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tasks)
        .set({ completedAt: app.now(), updatedAt: app.now() })
        .where(and(owned(id, userId), isNull(tasks.completedAt)))
        .returning();
      if (updated) {
        const pointsAwarded = QUADRANT_POINTS[updated.quadrant];
        await award(tx, userId, pointsAwarded, 'task_complete', updated.id);

        let nextTask = null;
        if (updated.recurrence !== 'none') {
          const [owner] = await tx
            .select({ tz: users.timezone })
            .from(users)
            .where(eq(users.id, userId));
          const dueAt = updated.dueAt
            ? await nextDueAt(tx, updated.dueAt, updated.recurrence, owner?.tz ?? 'UTC', app.now())
            : null;
          [nextTask] = await tx
            .insert(tasks)
            .values({
              userId,
              title: updated.title,
              description: updated.description,
              quadrant: updated.quadrant,
              recurrence: updated.recurrence,
              dueAt,
            })
            .returning();
        }
        return { task: updated, pointsAwarded, nextTask };
      }
      const [existing] = await tx.select().from(tasks).where(owned(id, userId));
      return existing ? { task: existing, pointsAwarded: 0, nextTask: null } : null;
    });
    if (!result) return reply.status(404).send({ error: 'Task not found' });
    const steps = await stepsByTask(app.db, userId, [result.task.id]);
    return {
      ...result.task,
      steps: steps.get(result.task.id) ?? [],
      pointsAwarded: result.pointsAwarded,
      nextTask: result.nextTask ? { ...result.nextTask, steps: [] } : null,
    };
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
