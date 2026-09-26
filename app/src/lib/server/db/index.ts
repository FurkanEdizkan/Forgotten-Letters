import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

const url = env.DATABASE_URL ?? 'local.db';

if (!building) mkdirSync(dirname(url), { recursive: true });

const client = new Database(building ? ':memory:' : url);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });

if (!building) migrate(db, { migrationsFolder: env.MIGRATIONS_DIR ?? 'drizzle' });
