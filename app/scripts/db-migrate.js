// Apply pending migrations from drizzle/ (or MIGRATIONS_DIR) to DATABASE_URL. The app does this itself at start;
// this is for development and CI: `npm run db:migrate`.
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { databaseUrl } from './db-url.js';

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
try {
	await migrate(drizzle(sql), {
		migrationsFolder: resolve(process.env.MIGRATIONS_DIR ?? 'drizzle')
	});
	console.log('Migrations applied.');
} finally {
	await sql.end();
}
