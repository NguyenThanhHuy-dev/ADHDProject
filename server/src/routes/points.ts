import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { pointLedger } from '../db/schema';
import { getBalance } from '../domain/points';

export const pointRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const userId = request.user.sub;
    const history = await app.db
      .select({
        id: pointLedger.id,
        amount: pointLedger.amount,
        reason: pointLedger.reason,
        createdAt: pointLedger.createdAt,
      })
      .from(pointLedger)
      .where(eq(pointLedger.userId, userId))
      .orderBy(desc(pointLedger.createdAt))
      .limit(50);
    return { balance: await getBalance(app.db, userId), history };
  });
};
