import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config';
import { createDb } from './client';

const { DATABASE_URL } = loadConfig();
const { db, close } = createDb(DATABASE_URL);

await migrate(db, { migrationsFolder: './drizzle' });
await close();
console.log('Migrations applied');
