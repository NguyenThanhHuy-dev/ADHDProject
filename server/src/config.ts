import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  JOBS_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(15),
  // Optional: without a key the "suggest steps" feature is switched off.
  // An empty value (as docker compose passes when unset) means "not configured".
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  AI_MODEL: z.string().min(1).default('claude-opus-5-5'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Config = z.infer<typeof schema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => schema.parse(env);
