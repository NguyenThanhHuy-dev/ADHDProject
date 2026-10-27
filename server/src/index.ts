import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { startScheduler } from './jobs/scheduler';
import { createAnthropicSuggester } from './services/ai';
import { createWebPushSender } from './services/push';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const suggester = config.ANTHROPIC_API_KEY
  ? createAnthropicSuggester(config.ANTHROPIC_API_KEY, config.AI_MODEL)
  : null;
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = config;
const pushSender =
  VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT
    ? createWebPushSender({
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY,
        subject: VAPID_SUBJECT,
      })
    : null;
const app = await buildApp(db, config, { suggester, pushSender });

const stopScheduler = config.JOBS_ENABLED
  ? startScheduler(db, app.log, config.JOBS_INTERVAL_MINUTES * 60_000, pushSender)
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
