import { error, json } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { BattleError, planGame } from '$lib/server/games';
import { publish } from '$lib/server/hub';

/** Plan a battle from the map: { zone, aggressor, defender, override? } → a scheduled game. */
export async function POST({ request }) {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const body = await request.json().catch(() => null);
	if (!body) error(400, 'Malformed request');
	try {
		const g = planGame(c, {
			zone: String(body.zone ?? ''),
			aggressor: String(body.aggressor ?? ''),
			defender: String(body.defender ?? ''),
			override: body.override === true,
			status: 'scheduled'
		});
		publish(c.id);
		return json({ id: g.id });
	} catch (e) {
		if (e instanceof BattleError) return json({ message: e.message }, { status: 400 });
		throw e;
	}
}
