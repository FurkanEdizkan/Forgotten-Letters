import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests of signing in and access, run against a throwaway stack by ../scripts/e2e.sh (never the live one).
 * E2E_BASE is the stack's address, E2E_ACCESS the mode it runs in (open | private), E2E_LAN_BASE the same stack
 * reached over this machine's network address (the open-mode "another device on the LAN" checks).
 */
export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/setup.ts',
	// One stack, shared accounts: run in order.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 30_000,
	reporter: [['list']],
	use: {
		baseURL: process.env.E2E_BASE ?? 'http://localhost:3200',
		trace: 'retain-on-failure'
	}
});
