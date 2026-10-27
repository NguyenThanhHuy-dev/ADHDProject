import { and, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { taskSteps, tasks } from '../db/schema';
import { MAX_STEPS_PER_TASK, stepsByTask, toStepView } from '../domain/steps';
import { AiBadOutputError, AiRefusedError } from '../services/ai';

const taskParams = z.object({ taskId: z.string().uuid() });
const stepParams = taskParams.extend({ stepId: z.string().uuid() });

const addBody = z.object({
  titles: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
});
const updateBody = z
  .object({ title: z.string().trim().min(1).max(120), done: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const stepRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const ownedTask = (taskId: string, userId: string) =>
    and(eq(tasks.id, taskId), eq(tasks.userId, userId));

  // Adds steps at the end. The task row is locked so two parallel requests cannot pass the limit together.
  app.post('/', async (request, reply) => {
    const { taskId } = taskParams.parse(request.params);
    const { titles } = addBody.parse(request.body);
    const userId = request.user.sub;

    const result = await app.db.transaction(async (tx) => {
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(ownedTask(taskId, userId))
        .for('update');
      if (!task) return { status: 404 as const, body: { error: 'Task not found' } };

      const [{ count, next }] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          next: sql<number>`coalesce(max(${taskSteps.position}) + 1, 0)::int`,
        })
        .from(taskSteps)
        .where(eq(taskSteps.taskId, taskId));
      if (count + titles.length > MAX_STEPS_PER_TASK) {
        return {
          status: 400 as const,
          body: { error: `A task can have at most ${MAX_STEPS_PER_TASK} steps` },
        };
      }
      await tx
        .insert(taskSteps)
        .values(titles.map((title, i) => ({ taskId, userId, title, position: next + i })));
      return {
        status: 201 as const,
        body: (await stepsByTask(tx, userId, [taskId])).get(taskId) ?? [],
      };
    });
    return reply.status(result.status).send(result.body);
  });

  app.patch('/:stepId', async (request, reply) => {
    const { taskId, stepId } = stepParams.parse(request.params);
    const { title, done } = updateBody.parse(request.body);
    const [step] = await app.db
      .update(taskSteps)
      .set({
        ...(title !== undefined && { title }),
        ...(done !== undefined && { doneAt: done ? app.now() : null }),
      })
      .where(
        and(
          eq(taskSteps.id, stepId),
          eq(taskSteps.taskId, taskId),
          eq(taskSteps.userId, request.user.sub),
        ),
      )
      .returning();
    if (!step) return reply.status(404).send({ error: 'Step not found' });
    return toStepView(step);
  });

  app.delete('/:stepId', async (request, reply) => {
    const { taskId, stepId } = stepParams.parse(request.params);
    const deleted = await app.db
      .delete(taskSteps)
      .where(
        and(
          eq(taskSteps.id, stepId),
          eq(taskSteps.taskId, taskId),
          eq(taskSteps.userId, request.user.sub),
        ),
      )
      .returning({ id: taskSteps.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Step not found' });
    return reply.status(204).send();
  });

  // Suggestions are returned, not saved: the user picks which ones to keep.
  app.post(
    '/suggest',
    {
      config: {
        rateLimit: {
          max: app.config.NODE_ENV === 'test' ? 10_000 : 20,
          timeWindow: '1 hour',
          // Key by user, not address: the JWT is verified by the handler, this only buckets requests.
          keyGenerator: (req) => {
            const token = req.cookies.adhd_token;
            if (!token) return req.ip;
            try {
              return app.jwt.decode<{ sub: string }>(token)?.sub ?? req.ip;
            } catch {
              return req.ip; // malformed token: the handler will reject it with a 401
            }
          },
        },
      },
    },
    async (request, reply) => {
      if (!app.suggester) {
        return reply
          .status(503)
          .send({ error: 'AI suggestions are not configured on this server' });
      }
      const { taskId } = taskParams.parse(request.params);
      const [task] = await app.db
        .select({ title: tasks.title, description: tasks.description })
        .from(tasks)
        .where(ownedTask(taskId, request.user.sub));
      if (!task) return reply.status(404).send({ error: 'Task not found' });

      try {
        return { steps: await app.suggester.suggest(task) };
      } catch (error) {
        if (error instanceof AiRefusedError) {
          return reply.status(422).send({ error: 'The AI could not suggest steps for this task' });
        }
        if (!(error instanceof AiBadOutputError)) app.log.error(error, 'step suggestion failed');
        return reply
          .status(502)
          .send({ error: 'The AI service is not available right now, try again later' });
      }
    },
  );
};
