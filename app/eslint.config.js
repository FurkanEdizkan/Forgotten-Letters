import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

/** One import restriction: the globs it bans and why. */
const layer = (group, message) => ({ group, message });

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	// Layers point one way: routes -> services -> repos (ARCHITECTURE.md §5). Patterns cover the #lib alias and
	// relative paths. Each block owns its folder, so their rule options never override one another.
	{
		files: ['src/routes/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						layer(['**/repos', '**/repos/**'], 'Routes call services, not repos.'),
						layer(['drizzle-orm', 'drizzle-orm/**'], 'SQL lives in repos.')
					]
				}
			]
		}
	},
	{
		files: ['src/lib/server/services/**'],
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							...layer(
								['@sveltejs/kit', '@sveltejs/kit/**'],
								'Services know nothing of requests; throw AppError instead.'
							),
							allowTypeImports: true
						},
						layer(['**/routes', '**/routes/**'], 'Services never import routes.')
					]
				}
			]
		}
	},
	{
		files: ['src/lib/server/repos/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: [layer(['**/services', '**/services/**'], 'Repos never call services.')] }
			]
		}
	},
	{
		files: ['src/lib/**'],
		ignores: ['src/lib/server/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						layer(
							['#lib/server', '#lib/server/**', '**/server', '**/server/**'],
							'Shared and browser code never imports server code.'
						)
					]
				}
			]
		}
	},
	// The app is always served at `/` (no kit.paths.base), so plain hrefs are correct; resolve() would only add route
	// ids with groups to every link, including the dynamic area links from areasFor().
	{ rules: { 'svelte/no-navigation-without-resolve': 'off' } }
);
