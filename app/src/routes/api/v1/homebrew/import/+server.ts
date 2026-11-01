import { json } from '@sveltejs/kit';
import { api, body } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import { homebrewImport } from '#lib/schemas/homebrew';

/**
 * Import an exported homebrew set as a new one of mine, under a namespace of its own; refused with its problems if it fails its checks.
 * Who: anyone signed in, on a base they can see.
 * In: { files: { 'manifest.json': …, 'units.json': … }, name? }
 * Out: 201 Homebrew
 * Errors: 400 invalid with the problems, 401 unauthenticated, 403 forbidden other site, 404 not_found base not loaded.
 */
export const POST = api(async (event, ctx) =>
	json(await homebrew.importSet(ctx, await body(event, homebrewImport)), { status: 201 })
);
