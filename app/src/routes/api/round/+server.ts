import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { BattleError, rollScenario, rollWeatherSide, setWeather, startGame } from '$lib/server/games';
import { RoundError, openRoundOf, pickOpponent, pickOptions, rollForAggressor } from '$lib/server/rounds';
import { publish, sendTrigger } from '$lib/server/hub';
import { auditAuth } from '$lib/server/audit';
import type { RequestEvent } from './$types';

/** A player acts for a warband they play; the Campaign Master may act for anyone (someone absent, say). */
function mayActFor(event: RequestEvent, warbandId: string) {
	const u = event.locals.user;
	if (!u) error(401, 'Sign in first');
	if (!event.locals.isAdmin && !u.warbandIds.includes(warbandId)) error(403, 'Not your warband');
}

async function need() {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	return c;
}

const nameOf = async (id: string) => (await db.select({ name: warband.name }).from(warband).where(eq(warband.id, id)))[0]?.name ?? 'A warband';

/** For the Aggressor whose turn it is: the free opponents and the battlefields open against each. */
export async function GET(event) {
	const c = await need();
	const r = await openRoundOf(c);
	if (!r) return json(null);
	const options = await pickOptions(c, r.id);
	if (options) mayActFor(event, options.picker);
	return json(options);
}

export async function POST(event) {
	const c = await need();
	const body = (await event.request.json().catch(() => ({}))) as Record<string, string | boolean | undefined>;
	const str = (k: string) => String(body[k] ?? '');
	try {
		switch (body.op) {
			case 'roll': {
				const r = await openRoundOf(c);
				if (!r) error(400, 'No round in progress');
				mayActFor(event, str('warband'));
				const die = await rollForAggressor(c, r.id, str('warband'));
				auditAuth(event, 'round.roll', { targetType: 'warband', targetId: str('warband'), detail: { round: r.number, die } });
				return json({ die });
			}
			case 'pick': {
				const r = await openRoundOf(c);
				if (!r) error(400, 'No round in progress');
				mayActFor(event, str('aggressor'));
				await pickOpponent(c, r.id, str('aggressor'), str('defender'), str('zone'), event.locals.isAdmin && body.override === true);
				auditAuth(event, 'round.pick', { targetType: 'warband', targetId: str('aggressor'), detail: { round: r.number, defender: str('defender'), zone: str('zone') } });
				return json({ ok: true });
			}
		}

		// Battle steps: the battle's own players (or the Campaign Master).
		const [g] = await db.select().from(game).where(eq(game.id, str('game')));
		if (!g || g.campaignId !== c.id) error(404, 'No such battle');
		switch (body.op) {
			case 'weather-roll': {
				const side = str('warband') === g.aggressorId ? 'aggressor' : str('warband') === g.defenderId ? 'defender' : null;
				if (!side) error(400, 'That warband is not in this battle');
				mayActFor(event, str('warband'));
				const rolls = await rollWeatherSide(c, g, side);
				sendTrigger(c.id, {
					kind: 'roll',
					zone: g.zone,
					seed: Date.now(),
					roll: { warbandId: str('warband'), who: await nameOf(str('warband')), dice: rolls[side] ?? [], purpose: 'weather', label: 'Hell on Earth', gameId: g.id }
				});
				break;
			}
			case 'weather-choose': {
				const rolls = g.weatherRolls as { aggressor: number[] | null; defender: number[] | null; chooser: string | null } | null;
				if (!rolls?.aggressor || !rolls.defender) error(400, 'Both sides roll first');
				// The chooser picks; on a tie in CVP it is a roll-off, which the Campaign Master settles.
				if (rolls.chooser) mayActFor(event, rolls.chooser);
				else if (!event.locals.isAdmin) error(403, 'Tied: the Campaign Master settles the roll-off');
				const dice = body.pick === 'defender' ? rolls.defender : rolls.aggressor;
				await setWeather(g, dice[0] + dice[1]);
				break;
			}
			case 'scenario': {
				mayActFor(event, g.aggressorId);
				const s = await rollScenario(c, g);
				sendTrigger(c.id, {
					kind: 'roll',
					zone: g.zone,
					seed: Date.now(),
					roll: { warbandId: g.aggressorId, who: await nameOf(g.aggressorId), dice: [], purpose: 'scenario', label: s.name, gameId: g.id }
				});
				break;
			}
			case 'start': {
				if (!event.locals.isAdmin && !event.locals.user?.warbandIds.some((w) => w === g.aggressorId || w === g.defenderId)) error(403, 'Not your battle');
				// The weather is part of the battle: players settle it first (the Campaign Master may start regardless).
				if (!event.locals.isAdmin && !g.weatherEvent) error(400, 'Settle Hell on Earth first: both roll, then the chooser picks.');
				await startGame(g);
				break;
			}
			default:
				error(400, 'Unknown action');
		}
		auditAuth(event, `battle.${body.op}`, { targetType: 'game', targetId: g.id });
		publish(c.id);
		return json({ ok: true });
	} catch (e) {
		if (e instanceof RoundError || e instanceof BattleError) error(400, e.message);
		throw e;
	}
}
