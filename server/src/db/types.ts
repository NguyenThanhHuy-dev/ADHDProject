import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

// Works with both node-postgres (runtime) and PGlite (tests).
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
