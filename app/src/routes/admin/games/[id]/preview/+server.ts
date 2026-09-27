import { error, json } from '@sveltejs/kit';
import { findGame, parseDraft, previewGame } from '$lib/server/games';

export async function POST({ params, request }) {
	const { c, g } = await findGame(params.id);
	const draft = parseDraft(await request.json().catch(() => null), g);
	if (!draft) error(400, 'Malformed result');
	return json(await previewGame(c, g, draft));
}
