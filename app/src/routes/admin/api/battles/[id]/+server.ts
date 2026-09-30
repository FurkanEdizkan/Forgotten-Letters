import { error, json } from '@sveltejs/kit';
import { afterGameCancelled } from '$lib/server/rounds';
import { rosters } from '$lib/server/campaign';
import {
	BattleError,
	cancelGame,
	findGame,
	rollScenario,
	rollWeather,
	setWeather,
	startGame,
	swapSides
} from '$lib/server/games';
import { publish, sendTrigger } from '$lib/server/hub';

/**
 * Campaign Master actions on a planned or running battle:
 * { op: 'roll-weather' | 'choose-weather' | 'roll-scenario' | 'swap' | 'start' | 'cancel', event? }
 */
export async function POST({ params, request }) {
	const { c, g } = await findGame(params.id);
	const body = await request.json().catch(() => null);
	if (!body?.op) error(400, 'Malformed request');
	try {
		switch (body.op) {
			case 'roll-weather': {
				const rolls = await rollWeather(c, g);
				const names = new Map((await rosters(c.id)).map((r) => [r.warband.id, r.player.name]));
				// Every open map animates the same dice over the zone.
				sendTrigger(c.id, {
					kind: 'dice',
					zone: g.zone,
					seed: rolls.rolledAt,
					dice: {
						gameId: g.id,
						aggressor: { id: g.aggressorId, name: names.get(g.aggressorId) ?? '?', dice: rolls.aggressor! },
						defender: { id: g.defenderId, name: names.get(g.defenderId) ?? '?', dice: rolls.defender! },
						chooser: rolls.chooser
					}
				});
				break;
			}
			case 'choose-weather': {
				const event = body.event === null ? null : Number(body.event);
				await setWeather(g, event);
				break;
			}
			case 'roll-scenario':
				await rollScenario(c, g);
				break;
			case 'swap':
				await swapSides(g);
				break;
			case 'start':
				await startGame(g);
				break;
			case 'cancel':
				await cancelGame(g);
				// A battle of a round: its Aggressor gets the turn back to pick again.
				if (g.roundId) await afterGameCancelled(g.roundId);
				break;
			default:
				error(400, 'Unknown action');
		}
	} catch (e) {
		if (e instanceof BattleError) return json({ message: e.message }, { status: 400 });
		throw e;
	}
	publish(c.id);
	return json({ ok: true });
}
