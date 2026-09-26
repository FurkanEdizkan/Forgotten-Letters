import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { resolveUpload } from '$lib/server/uploads';

export async function GET({ params }) {
	const full = resolveUpload(`/uploads/${params.path}`);
	if (!full || !full.endsWith('.webp')) error(404);
	try {
		const body = await readFile(full);
		return new Response(body, {
			headers: {
				'content-type': 'image/webp',
				// Filenames are random UUIDs, so they never change content.
				'cache-control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		error(404);
	}
}
