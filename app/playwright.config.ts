import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	// The flows build on each other (the first owner, then their invites), so they run in order in one worker.
	workers: 1,
	fullyParallel: false,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		viewport: { width: 1366, height: 768 },
		// Use an already-installed Chromium when the bundled one is not downloaded (offline machines).
		launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
	},
	webServer: {
		command: 'npm run build && node e2e/server.js',
		url: 'http://localhost:4173/health/ready',
		timeout: 240_000,
		reuseExistingServer: false,
		stdout: 'ignore'
	}
});
