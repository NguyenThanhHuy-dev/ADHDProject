import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { inventoryItems, users } from '../db/schema';
import { award, getBalance } from '../domain/points';
import { findReward, GACHA_COST, REWARDS, rollReward } from '../domain/rewards';

export const rewardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/catalog', async () => ({ cost: GACHA_COST, rewards: REWARDS }));

  app.get('/inventory', async (request) => {
    const items = await app.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.userId, request.user.sub))
      .orderBy(desc(inventoryItems.obtainedAt));
    return items.flatMap((item) => {
      const reward = findReward(item.rewardId);
      return reward
        ? [{ ...reward, id: item.id, rewardId: item.rewardId, obtainedAt: item.obtainedAt }]
        : [];
    });
  });

  // The roll and the payment happen together on the server; the client cannot pick or skip either.
  app.post('/gacha', async (request, reply) => {
    const userId = request.user.sub;
    const result = await app.db.transaction(async (tx) => {
      // Serialises this user's spends so two parallel pulls cannot both pass the balance check.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');

      const balance = await getBalance(tx, userId);
      if (balance < GACHA_COST) {
        return {
          status: 402 as const,
          body: { error: 'Not enough points', balance, cost: GACHA_COST },
        };
      }
      const reward = rollReward(app.random);
      const [item] = await tx
        .insert(inventoryItems)
        .values({ userId, rewardId: reward.id, rarity: reward.rarity, obtainedAt: app.now() })
        .returning();
      await award(tx, userId, -GACHA_COST, 'gacha_spend', item.id);
      return {
        status: 200 as const,
        body: { reward, inventoryId: item.id, balance: balance - GACHA_COST },
      };
    });
    return reply.status(result.status).send(result.body);
  });
};
