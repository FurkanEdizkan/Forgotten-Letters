import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	casing: 'snake_case',
	schemaFilter: ['auth', 'app'],
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'postgres://letters:letters@localhost:5432/letters'
	}
});
