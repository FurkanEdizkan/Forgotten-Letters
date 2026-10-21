/**
 * The database pool (postgres.js) and the Drizzle client. One pool per app; every connection has a statement
 * timeout so no query runs forever. `Tx` is a transaction or the pool itself, so repos work in both.
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../infra/config';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db;

let client: ReturnType<typeof postgres> | null = null;
let instance: Db | null = null;

function open(url = config().databaseUrl) {
	client = postgres(url, {
		max: config().DB_POOL_MAX,
		connect_timeout: 5,
		idle_timeout: 60,
		onnotice: () => {},
		connection: {
			statement_timeout: config().DB_STATEMENT_TIMEOUT_MS,
			application_name: 'forgotten-letters'
		}
	});
	instance = drizzle(client, { schema, casing: 'snake_case' });
	return instance;
}

/** The app's database. */
export function db(): Db {
	return instance ?? open();
}

/** The raw postgres.js client (migrations, advisory locks, health). */
export function sqlClient() {
	if (!client) open();
	return client!;
}

/** Use another database (tests). */
export function useDatabase(url: string) {
	return open(url);
}

export async function closeDb() {
	await client?.end({ timeout: 5 });
	client = null;
	instance = null;
}

/** Is the database answering? */
export async function ping(): Promise<boolean> {
	try {
		await sqlClient()`select 1`;
		return true;
	} catch {
		return false;
	}
}

/** Wait for the database at start, with backoff (a container may start before Postgres is ready). */
export async function waitForDb(tries = 30) {
	for (let n = 0; n < tries; n++) {
		if (await ping()) return;
		await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** n, 5000)));
	}
	throw new Error('The database did not answer. Is the db container running?');
}
