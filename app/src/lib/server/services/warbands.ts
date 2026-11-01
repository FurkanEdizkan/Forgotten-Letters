/**
 * Warbands: a player owns them; one sits in at most one campaign at a time (a seat). Creating, listing, reading,
 * changing the warband's own fields, deleting, exporting (Trench Companion text, our JSON), importing Trench
 * Companion text; seats are in `warband-seats.ts` (re-exported here). The roster is in `warband-roster.ts`, the stash,
 * fireteams and locations in `warband-stash.ts`, images in `fighter-images.ts`; the shared core in `warband-state.ts`.
 */
import { isHomebrewSet } from '#lib/rules/homebrew';
import {
	dedicationVariant,
	fromJson,
	fromTcJson,
	fromText,
	resolveFaction,
	toJson,
	toText,
	type SetWithBase
} from '#lib/warbands';
import type {
	ApiWarband,
	ApiWarbandCard,
	WarbandCreate,
	WarbandImport,
	WarbandPatch
} from '#lib/schemas/warbands';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/warbands';
import { record, type Ctx } from './audit';
import { requireUser } from './auth';
import * as images from './fighter-images';
import { homebrewAllowed, mySeat, seatWarband } from './warband-seats';
import { pickRules } from './warband-choices';
import * as rules from './rules';
import {
	allowChange,
	cardOf,
	load,
	optionsFor,
	reloadView,
	resolveFor,
	stale,
	stateOf,
	viewOf
} from './warband-state';
import { patronChangeable } from './warband-view';

const invalid = (field: string, message: string) =>
	new AppError('invalid', message, { [field]: message });

// ---------------------------------------------------------------- reading

/** My warbands, by name, each with its rating, problems and seat. */
export async function listMine(ctx: Ctx): Promise<ApiWarbandCard[]> {
	const me = requireUser(ctx);
	const rows = await repo.listByOwner(db(), me.id);
	const ids = rows.map((w) => w.id);
	const [fighters, seats] = await Promise.all([
		repo.fightersOf(db(), ids),
		repo.seatsOf(db(), ids)
	]);
	return Promise.all(
		rows.map(async (w) => {
			const seat = seats.find((s) => s.warbandId === w.id && !s.deletedAt) ?? null;
			try {
				const { set, f } = await resolveFor(w, w.factionId, w.variantId, w.dedication);
				const state = stateOf(
					w,
					fighters.filter((x) => x.warbandId === w.id),
					set
				);
				return cardOf(w, { f, state, opts: optionsFor(seat, w) }, seat);
			} catch {
				return cardOf(w, null, seat);
			}
		})
	);
}

/** One warband: its owner, or the CM and co-CMs of the campaign it sits in (read-only). */
export async function get(ctx: Ctx, id: string): Promise<ApiWarband> {
	return viewOf(db(), await load(db(), ctx, id));
}

/** The warband as Trench Companion text (its Full layout) or as our own JSON. */
export async function exportOf(ctx: Ctx, id: string, format: 'text' | 'json') {
	const l = await load(db(), ctx, id);
	return format === 'json'
		? { body: toJson(l.state), type: 'application/json', ext: 'json', name: l.w.name }
		: { body: toText(l.state, l.f, l.opts), type: 'text/plain', ext: 'txt', name: l.w.name };
}

// ---------------------------------------------------------------- creating

/**
 * Create a warband: faction (and variant), Patron, name and ducat limit (default: the faction's starting Ducats),
 * for the newest core rules or, created from a seat, the campaign's rules, then it takes that seat. Its banks start
 * full: the limit in Ducats, the faction's starting Glory.
 */
export async function create(ctx: Ctx, input: WarbandCreate): Promise<ApiWarband> {
	const me = requireUser(ctx);
	return db().transaction(async (tx) => {
		const at = input.campaignId ? await mySeat(tx, ctx, input.campaignId) : null;
		const hb = (input.rulesExpansions ?? []).filter(isHomebrewSet);
		await rules.mayUse(ctx, hb);
		// From a seat: the campaign's rules, with the homebrew picked if the campaign allows it.
		if (at) await homebrewAllowed(at.a.c, hb);
		const picked = at
			? { rulesSet: at.a.c.rulesSet, rulesExpansions: [...at.a.c.rulesExpansions, ...hb] }
			: await pickRules(input);
		const set = await rules.rulesSetOf(picked.rulesSet, picked.rulesExpansions);
		let f;
		try {
			f = resolveFaction(set, input.factionId, input.variantId, input.dedication);
		} catch {
			throw invalid(input.variantId ? 'variantId' : 'factionId', 'Pick a faction of these rules.');
		}
		const keys = f.faction.dedications?.map((d) => d.key) ?? [];
		if (input.dedication && !keys.includes(input.dedication))
			throw invalid('dedication', 'Pick one of the faction’s dedications.');
		if (input.patronId && !f.patrons.some((p) => p.id === input.patronId))
			throw invalid('patronId', 'This warband cannot serve that Patron.');
		const ducatLimit = input.ducatLimit ?? f.rules.startDucats;
		const w = await repo.insert(tx, {
			ownerId: me.id,
			name: input.name,
			...picked,
			factionId: f.faction.id,
			variantId: f.dedication ? null : (f.variant?.id ?? null),
			dedication: input.dedication ?? null,
			patronId: input.patronId ?? null,
			ducatLimit,
			stashDucats: ducatLimit,
			unspentGlory: input.unspentGlory ?? f.rules.startGlory,
			ignoreLimits: !!input.ignoreLimits
		});
		await record(tx, ctx, 'warband.created', { type: 'warband', id: w.id }, { name: w.name });
		if (at && !at.seat.warbandId) await seatWarband(tx, ctx, at.seat.id, w.id);
		return reloadView(tx, ctx, w.id);
	});
}

/**
 * Import a warband for these rules (the newest core when none is given): a Trench Companion text export, or a JSON
 * export (ours, or Trench Companion's). Names are matched to the rules; what does not match is reported (unmatched),
 * as is kit with more than one source (ambiguous). The list is kept as it was, even if it breaks a limit: the
 * problem list says so. `gamesPlayed` sets the refund window and the next game's Threshold (R1).
 */
export async function importText(ctx: Ctx, input: WarbandImport) {
	const me = requireUser(ctx);
	const picked = await pickRules(input);
	await rules.mayUse(ctx, picked.rulesExpansions.filter(isHomebrewSet));
	const set = await rules.rulesSetOf(picked.rulesSet, picked.rulesExpansions);
	let read;
	try {
		read = input.format === 'json' ? readJson(input.text, set) : fromText(input.text, set);
	} catch (e) {
		throw invalid('text', e instanceof Error ? e.message : 'That text is not a warband.');
	}
	const s = read.state;
	return db().transaction(async (tx) => {
		const w = await repo.insert(tx, {
			ownerId: me.id,
			name: (input.name ?? s.name ?? 'Imported warband').slice(0, 80),
			...picked,
			factionId: s.factionId,
			variantId: s.variantId ?? null,
			dedication: s.dedication ?? null,
			patronId: s.patronId ?? null,
			ducatLimit: s.ducatLimit,
			stashDucats: s.stashDucats,
			unspentGlory: s.unspentGlory,
			stash: s.stash,
			gamesPlayed: input.gamesPlayed ?? 0,
			locations: s.locations.map((l) => ({
				name: l.name.slice(0, 120),
				...(l.note ? { note: l.note } : {})
			}))
		});
		const made = await repo.insertFighters(
			tx,
			s.fighters.map((x, i) => ({
				warbandId: w.id,
				unitId: x.unitId,
				name: x.name?.slice(0, 120) || null,
				grp: x.group,
				kit: x.kit,
				upgrades: x.upgrades,
				skills: x.skills,
				injuries: x.injuries,
				xp: Math.min(x.xp, 1000),
				status: x.status ?? (x.group === 'dead' ? 'dead' : 'active'),
				battleScars: Math.min(x.scars ?? 0, 10),
				sort: i + 1
			}))
		);
		// The import names fighters f1, f2, …; their fireteams follow them to the stored ids.
		const idOf = new Map(s.fighters.map((x, i) => [x.id, made[i]!.id]));
		const fireteams = s.fireteams
			.map(([a, b]) => [idOf.get(a), idOf.get(b)])
			.filter((t): t is [string, string] => !!t[0] && !!t[1]);
		if (fireteams.length) await repo.update(tx, w.id, { fireteams });
		await record(
			tx,
			ctx,
			'warband.imported',
			{ type: 'warband', id: w.id },
			{ unmatched: read.unmatched.length }
		);
		return {
			warband: await reloadView(tx, ctx, w.id),
			unmatched: read.unmatched,
			ambiguous: read.ambiguous
		};
	});
}

// ---------------------------------------------------------------- changing

/**
 * Change the warband's own fields (name, Patron, dedication, limit, banks, notes, games played, victory points,
 * failed promotions, ignore limits), with a version check. Once a seated warband has played, only its campaign's
 * masters change the Patron, and they change nothing else (R8). A new dedication that lays another overlay (the
 * Court's Sin) is saved as it is; the problem list says what no longer fits.
 */
export async function patch(ctx: Ctx, id: string, input: WarbandPatch): Promise<ApiWarband> {
	return db().transaction(async (tx) => {
		const l = await load(tx, ctx, id, { lock: true });
		if (l.w.version !== input.version) throw stale();
		const given = Object.entries(input)
			.filter(([k, v]) => k !== 'version' && v !== undefined)
			.map(([k]) => k);
		const patron = input.patronId !== undefined && input.patronId !== l.w.patronId;
		if (!l.canEdit && (given.some((k) => k !== 'patronId') || !patronChangeable(l)))
			throw new AppError('forbidden', 'Only its owner can change a warband.');
		if (patron && !patronChangeable(l))
			throw new AppError(
				'forbidden',
				'The warband has played: only the campaign master can change its Patron now.'
			);
		if (input.patronId && !l.f.patrons.some((p) => p.id === input.patronId))
			throw invalid('patronId', 'This warband cannot serve that Patron.');
		const keys = l.f.faction.dedications?.map((d) => d.key) ?? [];
		if (input.dedication && !keys.includes(input.dedication))
			throw invalid('dedication', 'Pick one of the faction’s dedications.');
		const fields: repo.WarbandFields = {
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.patronId !== undefined ? { patronId: input.patronId } : {}),
			...(input.dedication !== undefined ? { dedication: input.dedication } : {}),
			...(input.ducatLimit !== undefined ? { ducatLimit: input.ducatLimit } : {}),
			...(input.stashDucats !== undefined ? { stashDucats: input.stashDucats } : {}),
			...(input.unspentGlory !== undefined ? { unspentGlory: input.unspentGlory } : {}),
			...(input.notes !== undefined ? { notes: input.notes } : {}),
			...(input.gamesPlayed !== undefined ? { gamesPlayed: input.gamesPlayed } : {}),
			...(input.victoryPoints !== undefined ? { victoryPoints: input.victoryPoints } : {}),
			...(input.failedPromotions !== undefined ? { failedPromotions: input.failedPromotions } : {}),
			...(input.ignoreLimits !== undefined ? { ignoreLimits: input.ignoreLimits } : {})
		};
		const overlayChanged =
			input.dedication !== undefined &&
			dedicationVariant(l.f.faction, input.dedication ?? undefined) !==
				dedicationVariant(l.f.faction, l.w.dedication ?? undefined);
		if (!overlayChanged) allowChange(l, stateOf({ ...l.w, ...fields }, l.rows, l.set));
		if (!(await repo.update(tx, id, fields, input.version))) throw stale();
		return reloadView(tx, ctx, id);
	});
}

/**
 * Copy a warband: the same rules, faction, banks, fighters (with their kit, Experience and campaign data; without
 * images), Arsenal, fireteams, locations and notes, as a new warband of the caller's, in no seat.
 */
export async function copy(ctx: Ctx, id: string, name?: string): Promise<ApiWarband> {
	const me = requireUser(ctx);
	return db().transaction(async (tx) => {
		const l = await load(tx, ctx, id, { edit: true });
		const w = await repo.insert(tx, {
			...l.w,
			id: undefined,
			createdAt: undefined,
			updatedAt: undefined,
			version: undefined,
			ownerId: me.id,
			name: name ?? `${l.w.name} (copy)`.slice(0, 80),
			fireteams: []
		});
		const made = await repo.insertFighters(
			tx,
			l.rows.map((r) => ({
				warbandId: w.id,
				unitId: r.unitId,
				name: r.name,
				grp: r.grp,
				kit: r.kit,
				upgrades: r.upgrades,
				skills: r.skills,
				injuries: r.injuries,
				xp: r.xp,
				status: r.status,
				battleScars: r.battleScars,
				sort: r.sort
			}))
		);
		const idOf = new Map(l.rows.map((r, i) => [r.id, made[i]!.id]));
		const fireteams = l.w.fireteams
			.map(([a, b]) => [idOf.get(a), idOf.get(b)])
			.filter((t): t is [string, string] => !!t[0] && !!t[1]);
		if (fireteams.length) await repo.update(tx, w.id, { fireteams });
		await record(
			tx,
			ctx,
			'warband.created',
			{ type: 'warband', id: w.id },
			{ name: w.name, from: id }
		);
		return reloadView(tx, ctx, w.id);
	});
}

/** A JSON export as a warband: ours (ids as stored), else Trench Companion's (names matched to the rules). */
function readJson(text: string, set: SetWithBase) {
	const ours = fromJson(text);
	if (ours.ok) return { state: ours.state, unmatched: [] as string[], ambiguous: [] as string[] };
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error('That is not JSON.');
	}
	if ((raw as { app?: unknown })?.app) throw new Error(ours.error);
	return fromTcJson(raw, set);
}

/** Delete a warband for good: it leaves its seat, its fighters and their images go too. */
export async function remove(ctx: Ctx, id: string): Promise<void> {
	await db().transaction(async (tx) => {
		const l = await load(tx, ctx, id, { lock: true, edit: true });
		await repo.remove(tx, [id]);
		await record(tx, ctx, 'warband.deleted', { type: 'warband', id }, { name: l.w.name });
	});
	await images.removeWarbands([id]);
}

/** Remove every warband of an account (it is anonymised); run inside its transaction, files after commit. */
export async function removeAllOf(tx: Tx, userId: string): Promise<string[]> {
	return (await repo.remove(tx, await repo.idsOfOwner(tx, userId))).map((r) => r.id);
}

export { assignToSeat, clearSeat, ofCampaign } from './warband-seats';
export { choices } from './warband-choices';
