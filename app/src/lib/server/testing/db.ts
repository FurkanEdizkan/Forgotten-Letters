/**
 * Service tests on real PostgreSQL. `useTestDatabase()` gives the calling test file its own fresh database in the
 * run's container, points the app at it (`useDatabase`), applies the migrations with `runMigrations()` and empties
 * the auth tables (and resets the settings row and its caches) before every test. Helpers make people and request contexts.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import type { Role } from '#lib/roles';
import { closeDb, db, sqlClient, useDatabase } from '../db';
import { logger } from '../infra/logger';
import { runMigrations } from '../infra/migrate';
import * as usersRepo from '../repos/users';
import type { Ctx, SessionUser } from '../services/audit';
import { createSession, signInLimiter, toSessionUser } from '../services/auth';
import { forgetCachedSettings } from '../services/settings';
import { forgetSetupState } from '../services/setup';
import { hashPassword, tokenHash } from '../services/passwords';

/** The password every helper-made person has. */
export const PASSWORD = 'correct horse battery';
let passwordHash = '';

/** Create an empty database in the container; returns its connection string. */
export async function createDatabase() {
	const admin = inject('adminUrl');
	const name = `t_${randomBytes(6).toString('hex')}`;
	const sql = postgres(admin, { max: 1, onnotice: () => {} });
	try {
		await sql.unsafe(`create database ${name}`);
	} finally {
		await sql.end();
	}
	const url = new URL(admin);
	url.pathname = `/${name}`;
	return url.toString();
}

/** Point the app at a database (sets the env the config reads, then opens the pool). */
export function pointAppAt(url: string) {
	process.env.DATABASE_URL = url;
	process.env.RUN_STARTUP = 'false';
	process.env.NODE_ENV = 'test';
	process.env.BACKUP_DIR ??= `/tmp/letters-test-backups-${process.pid}`;
	logger.level = 'silent';
	useDatabase(url);
}

/** Register the hooks for a test file that talks to the database. */
export function useTestDatabase() {
	beforeAll(async () => {
		pointAppAt(await createDatabase());
		await runMigrations();
		passwordHash ||= await hashPassword(PASSWORD);
	});
	beforeEach(async () => {
		await sqlClient()`truncate auth.audit_log, auth.sessions, auth.invites, auth.users restart identity cascade`;
		// The cascade empties app.settings too (updated_by points at auth.users): put back the row the migration made.
		await sqlClient()`insert into app.settings (id) values (1)`;
		forgetCachedSettings();
		forgetSetupState();
	});
	afterAll(closeDb);
}

/** A request context; a fresh address each time so the sign-in limit never leaks between tests. */
export function ctx(actor: SessionUser | null = null): Ctx {
	return {
		actor,
		ip: `10.${rnd()}.${rnd()}.${rnd()}`,
		userAgent: 'vitest',
		requestId: randomUUID()
	};
}
const rnd = () => randomBytes(1)[0]!;

let n = 0;
/** A unique, valid username. */
export const uniqueName = (prefix = 'member') => `${prefix}${++n}${randomBytes(2).toString('hex')}`;

/** An account with a signed-in session; password is `PASSWORD`. */
export async function person(
	role: Role,
	opts: { username?: string; invitedBy?: string; displayName?: string } = {}
) {
	const username = opts.username ?? uniqueName(role);
	const row = await usersRepo.insert(db(), {
		username,
		displayName: opts.displayName ?? username,
		passwordHash,
		role,
		invitedBy: opts.invitedBy ?? null
	});
	if (!row) throw new Error(`could not insert ${username}`);
	const session = await createSession(db(), row.id, false, ctx());
	const fresh = (await usersRepo.findById(db(), row.id))!;
	signInLimiter.clear(`u:${username}`);
	return {
		row: fresh,
		token: session.token,
		actor: toSessionUser(fresh, tokenHash(session.token)),
		ctx: () => ctx(toSessionUser(fresh, tokenHash(session.token)))
	};
}

/** Run a raw query against the test database. */
export const sql = () => sqlClient();
