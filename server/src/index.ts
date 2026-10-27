import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { startScheduler } from './jobs/scheduler';
import { createAnthropicSuggester } from './services/ai';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const suggester = config.ANTHROPIC_API_KEY
  ? createAnthropicSuggester(config.ANTHROPIC_API_KEY, config.AI_MODEL)
  : null;
const app = await buildApp(db, config, { suggester });

const stopScheduler = config.JOBS_ENABLED
  ? startScheduler(db, app.log, config.JOBS_INTERVAL_MINUTES * 60_000)
  : () => {};

const shutdown = async () => {
  stopScheduler();
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
