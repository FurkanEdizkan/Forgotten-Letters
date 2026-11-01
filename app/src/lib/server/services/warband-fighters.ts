/**
 * A fighter's own record: edit it (name, rank, status, Experience, Battle Scars, advancements, injuries), copy it
 * (paid from the banks) or remove it (refunded before the first game, or deleted with nothing back). Recruiting and
 * kit are in `warband-roster.ts`, which re-exports these.
 */
import { campaign, canCopy, isActive, no, skillRef } from '#lib/warbands';
import type { ApiWarband, FighterPatch } from '#lib/schemas/warbands';
import { AppError } from '../errors';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import * as images from './fighter-images';
import {
	allowChange,
	change,
	decide,
	fighterOf,
	payFor,
	stale,
	type Loaded
} from './warband-state';

/** A skill or injury as given: an id kept, a name matched to the rules, anything else kept as text. */
const refOf = (l: Loaded, s: string) => (/^(skill|table):/.test(s) ? s : (skillRef(l.f, s) ?? s));

/**
 * Edit a fighter: name, Experience, Battle Scars, skills (advancements) and injuries, status and rank; with its
 * version. Promotion (a Troop to the Elites) follows the book: never for entries that cannot be Promoted, never past
 * six ELITE models; Limited Potential caps Experience at 7 (refusals, unless limits are ignored). A fighter that
 * leaves the roster (unfit, retired, dead) leaves its fireteam; one made unfit for duty puts its bought kit in the
 * Arsenal. One brought back from the old Dead group returns to its entry's group.
 */
export function editFighter(ctx: Ctx, id: string, fid: string, input: FighterPatch) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		const unit = l.f.idx.units.get(x.unitId);
		let grp = input.group === 'dead' ? undefined : input.group;
		// The old way to bring a fighter back from the Dead was to move it to a group: it still is.
		const dead = x.group === 'dead' || x.status === 'dead';
		const status =
			input.group === 'dead' ? 'dead' : (input.status ?? (grp && dead ? 'active' : undefined));
		if (status && status !== 'dead' && x.group === 'dead' && !grp) grp = unit?.category ?? 'troop';
		const reasons: string[] = [];
		if (grp === 'elite' && x.group !== 'elite') {
			const why = campaign.promotion(l.state, l.f, x);
			if (why) reasons.push(why);
		}
		if (grp && grp !== 'elite' && x.group === 'elite' && unit?.category === 'elite')
			reasons.push(`A ${unit.name} is an Elite entry: it cannot be demoted.`);
		const cap = campaign.xpMax(unit);
		if (input.xp !== undefined && cap != null && input.xp > cap)
			reasons.push(`Limited Potential: a ${unit!.name} has at most ${cap} Experience.`);
		if (reasons.length) decide(l, no(...reasons));
		const unfit = status === 'unfit' && x.status !== 'unfit';
		const fields: repo.FighterFields = {
			...(input.name !== undefined ? { name: input.name || null } : {}),
			...(grp !== undefined ? { grp } : {}),
			...(status !== undefined ? { status } : {}),
			...(input.xp !== undefined ? { xp: input.xp } : {}),
			...(input.scars !== undefined ? { battleScars: input.scars } : {}),
			...(input.skills ? { skills: input.skills.map((s) => refOf(l, s)) } : {}),
			...(input.injuries ? { injuries: input.injuries.map((s) => refOf(l, s)) } : {}),
			...(unfit ? { kit: [] } : {})
		};
		const y = {
			...x,
			...(fields.name !== undefined ? { name: fields.name ?? undefined } : {}),
			...(fields.grp ? { group: fields.grp } : {}),
			...(fields.status ? { status: fields.status } : {}),
			...(fields.xp !== undefined ? { xp: fields.xp } : {}),
			...(fields.battleScars !== undefined ? { scars: fields.battleScars } : {}),
			...(fields.skills ? { skills: fields.skills } : {}),
			...(fields.injuries ? { injuries: fields.injuries } : {}),
			...(fields.kit ? { kit: fields.kit } : {})
		};
		const gone = !isActive(y);
		const fireteams = gone ? l.state.fireteams.filter((t) => !t.includes(fid)) : l.state.fireteams;
		const stash = unfit ? [...l.state.stash, ...x.kit] : l.state.stash;
		const after = {
			...l.state,
			fighters: l.state.fighters.map((f) => (f.id === fid ? y : f)),
			fireteams,
			stash
		};
		allowChange(l, after);
		if (!(await repo.updateFighter(tx, fid, fields, input.version))) throw stale();
		// Leaving the roster or coming back changes the worth on the table, not the banks (no refund).
		await repo.update(tx, l.w.id, {
			...(fireteams !== l.state.fireteams ? { fireteams } : {}),
			...(unfit ? { stash } : {})
		});
	});
}

/**
 * Remove a fighter: `refund` gives back what it was worth (only before the warband's first game); `delete` gives
 * nothing back and its kit goes with it. It leaves its fireteam, its image goes.
 */
export async function removeFighter(
	ctx: Ctx,
	id: string,
	fid: string,
	mode: 'refund' | 'delete' = 'delete'
): Promise<ApiWarband> {
	let hadImage = false;
	const out = await change(ctx, id, async (tx, l) => {
		fighterOf(l, fid);
		if (mode === 'refund' && !campaign.canRefund(l.w.gamesPlayed))
			throw new AppError(
				'conflict',
				'The warband has played a game: a fighter can no longer be refunded.'
			);
		hadImage = !!l.rows.find((r) => r.id === fid)?.image;
		const fireteams = l.state.fireteams.filter((t) => !t.includes(fid));
		const after = { ...l.state, fighters: l.state.fighters.filter((x) => x.id !== fid), fireteams };
		allowChange(l, after);
		await repo.removeFighter(tx, fid);
		if (mode === 'refund') await payFor(tx, l, after, { fireteams });
		else await repo.update(tx, l.w.id, { fireteams });
	});
	if (hadImage) await images.removeFile(id, fid);
	return out;
}

/**
 * Copy a fighter: the same entry, upgrades and bought kit (no name, skills, injuries or Experience), recruited and
 * paid for whole from the banks, with every recruit check.
 */
export function copyFighter(ctx: Ctx, id: string, fid: string) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		decide(l, canCopy(l.state, l.f, fid, l.opts));
		const grp = x.group === 'dead' ? (l.f.idx.units.get(x.unitId)?.category ?? 'troop') : x.group;
		const [made] = await repo.insertFighters(tx, [
			{
				warbandId: l.w.id,
				unitId: x.unitId,
				grp,
				upgrades: x.upgrades,
				kit: x.kit,
				sort: await repo.nextSort(tx, l.w.id)
			}
		]);
		const copy = {
			...x,
			id: made!.id,
			name: undefined,
			group: grp,
			skills: [],
			injuries: [],
			xp: 0,
			status: 'active' as const,
			scars: 0
		};
		await payFor(tx, l, { ...l.state, fighters: [...l.state.fighters, copy] });
	});
}
