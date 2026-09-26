import { error, json } from '@sveltejs/kit';
import { findGame, parseDraft, previewGame } from '$lib/server/games';

export async function POST({ params, request }) {
	const { c, g } = findGame(params.id);
	const draft = parseDraft(await request.json().catch(() => null), g);
	if (!draft) error(400, 'Malformed result');
	return json(previewGame(c, g, draft));
}
