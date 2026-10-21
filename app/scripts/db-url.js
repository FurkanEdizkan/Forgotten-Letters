// The database address, read the same way as src/lib/server/infra/config.ts: DATABASE_URL, or the POSTGRES_* parts,
// with secrets also accepted as <NAME>_FILE. Plain JS so the scripts run in the runtime image without a build.
import { readFileSync } from 'node:fs';

const secret = (name) =>
	process.env[name] ||
	(process.env[`${name}_FILE`]
		? readFileSync(process.env[`${name}_FILE`], 'utf8').trim()
		: undefined);

export function databaseUrl() {
	const url = secret('DATABASE_URL');
	if (url) return url;
	const password = secret('POSTGRES_PASSWORD');
	if (!password)
		throw new Error('Set DATABASE_URL, or POSTGRES_PASSWORD (or POSTGRES_PASSWORD_FILE)');
	const e = process.env;
	const enc = encodeURIComponent;
	return `postgres://${enc(e.POSTGRES_USER || 'letters')}:${enc(password)}@${e.POSTGRES_HOST || 'db'}:${e.POSTGRES_PORT || 5432}/${enc(e.POSTGRES_DB || 'letters')}`;
}
