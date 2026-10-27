/**
 * Settings, read once from the environment (.env through Docker Compose) and checked with zod. A missing or bad
 * value stops the app with a message naming the variable, never its value. Any secret may instead be given as a
 * file path in `<NAME>_FILE` (Docker secrets). Nothing else in the app reads process.env.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const SECRETS = ['DATABASE_URL', 'POSTGRES_PASSWORD'] as const;

const schema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
	/** Full connection string; or the POSTGRES_* parts below. */
	DATABASE_URL: z.string().url().optional(),
	POSTGRES_HOST: z.string().default('db'),
	POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
	POSTGRES_USER: z.string().default('letters'),
	POSTGRES_PASSWORD: z.string().optional(),
	POSTGRES_DB: z.string().default('letters'),
	DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
	DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
	/** The address people use, e.g. http://192.168.1.20:3000 or https://letters.example.org. */
	ORIGIN: z.string().url().optional(),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	BACKUP_DIR: z.string().default('/data/backups'),
	BACKUP_KEEP_DAYS: z.coerce.number().int().min(1).default(14),
	RETENTION_DAYS: z.coerce.number().int().min(7).default(180),
	/** Run migrations and jobs at start (off in unit tests that bring their own database). */
	RUN_STARTUP: z
		.enum(['true', 'false'])
		.default('true')
		.transform((v) => v === 'true'),
	/** The port is owned by someone else (Docker Compose publishes it): the UI shows it but cannot change it. */
	PORT_LOCKED: z
		.enum(['true', 'false', '1', '0'])
		.default('false')
		.transform((v) => v === 'true' || v === '1')
});

export type Config = z.infer<typeof schema> & { databaseUrl: string };

/** Reads `X_FILE` into `X` for every secret that has one. */
function withFiles(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const out = { ...env };
	for (const k of SECRETS) {
		const file = env[`${k}_FILE`];
		if (file && !env[k]) out[k] = readFileSync(file, 'utf8').trim();
	}
	return out;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const parsed = schema.safeParse(withFiles(env));
	if (!parsed.success) {
		const names = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
		throw new Error(`Bad settings in .env: ${names}`);
	}
	const c = parsed.data;
	const databaseUrl =
		c.DATABASE_URL ??
		(c.POSTGRES_PASSWORD
			? `postgres://${encodeURIComponent(c.POSTGRES_USER)}:${encodeURIComponent(c.POSTGRES_PASSWORD)}@${c.POSTGRES_HOST}:${c.POSTGRES_PORT}/${encodeURIComponent(c.POSTGRES_DB)}`
			: null);
	if (!databaseUrl)
		throw new Error(
			'Bad settings in .env: set DATABASE_URL, or POSTGRES_PASSWORD (or POSTGRES_PASSWORD_FILE)'
		);
	return Object.freeze({ ...c, databaseUrl });
}

let current: Config | null = null;

/** The app's settings, read on first use. */
export function config(): Config {
	return (current ??= readConfig());
}
