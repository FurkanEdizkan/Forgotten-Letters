import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const url = env.DATABASE_URL ?? 'postgres://carcass:carcass@localhost:5432/carcass';

// postgres.js connects lazily, so building the app never touches the database.
const client = postgres(url, { max: 10, onnotice: () => {} });

export const db = drizzle(client, { schema });

// server.js emits this once the HTTP server has closed (on SIGTERM / SIGINT).
process.on('sveltekit:shutdown', () => void client.end({ timeout: 5 }));
export type Db = typeof db;
/** A database handle or an open transaction: anything queries can run on. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db;

/** Bring the schema up to date; runs once at server start. */
export async function migrateDb() {
	await migrate(db, { migrationsFolder: env.MIGRATIONS_DIR ?? 'drizzle' });
}
