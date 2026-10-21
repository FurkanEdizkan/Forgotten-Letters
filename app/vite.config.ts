import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Origins are checked in hooks.server.ts (isCrossSite): Kit's check needs a build-time origin, which a
			// self-hosted image reached by any address cannot have.
			csrf: { trustedOrigins: ['*'] },
			// Everything ships with the app: no scripts, styles or fonts from other sites.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'frame-ancestors': ['none'],
					'form-action': ['self'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				// Pure rules: no database, fast.
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.db.{test,spec}.{js,ts}']
				}
			},
			{
				// Services on a real PostgreSQL 18 (one Testcontainers container per run, one database per file).
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.db.{test,spec}.{js,ts}'],
					globalSetup: ['src/lib/server/testing/global-setup.ts'],
					testTimeout: 30_000,
					hookTimeout: 120_000
				}
			}
		]
	}
});
