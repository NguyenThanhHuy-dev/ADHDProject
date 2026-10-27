import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/types';
import { runScheduledJobs } from './overdue';

export const startScheduler = (
  db: Db,
  log: Pick<FastifyBaseLogger, 'info' | 'error'>,
  intervalMs = 15 * 60_000,
) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runScheduledJobs(db, new Date());
      if (!result.skipped && result.overdue.penalized > 0) {
        log.info({ overdue: result.overdue }, 'overdue tasks charged');
      }
    } catch (error) {
      log.error(error, 'scheduled jobs failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  void tick();
  return () => clearInterval(timer);
};
