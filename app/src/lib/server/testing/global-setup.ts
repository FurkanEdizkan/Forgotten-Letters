/**
 * Vitest global setup for the `server` project: one PostgreSQL 18 container per test run. Each test file makes its
 * own database in it (see `db.ts`), so files run in parallel without seeing each other's rows.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
	export interface ProvidedContext {
		/** Connection string for the container's `postgres` database, used to create one database per test file. */
		adminUrl: string;
	}
}

export default async function setup(project: TestProject) {
	const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
		'postgres:18'
	).start();
	project.provide('adminUrl', container.getConnectionUri());
	return async () => {
		await container.stop();
	};
}
