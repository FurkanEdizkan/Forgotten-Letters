/**
 * Warbands: a player owns them; one sits in at most one campaign at a time (a seat). Creating, listing, reading,
 * changing the warband's own fields, deleting, exporting (Trench Companion text, our JSON), importing Trench
 * Companion text; seats are in `warband-seats.ts` (re-exported here). The roster is in `warband-roster.ts`, the stash,
 * fireteams and locations in `warband-stash.ts`, images in `fighter-images.ts`; the shared core in `warband-state.ts`.
 */
import { isHomebrewSet } from '#lib/rules/homebrew';
import { fromText, mergeSets, resolveFaction, toJson, toText } from '#lib/warbands';
import type {
	ApiChoices,
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

const invalid = (field: string, message: string) =>
	new AppError('invalid', message, { [field]: message });

// ---------------------------------------------------------------- rules choices

/** Loaded rules to build for: each core version (newest first) and each expansion on its base. */
async function rulesOptions() {
	const sets = (await rules.listSets()).filter((s) => s.ok);
	const byVersion = (a: { version: string | null }, b: { version: string | null }) =>
		(b.version ?? '').localeCompare(a.version ?? '', 'en', { numeric: true });
	const cores = sets.filter((s) => s.kind === 'core').sort(byVersion);
	const out = cores.map((c) => ({ value: c.id, label: `${c.name} ${c.version ?? ''}`.trim() }));
	for (const e of sets.filter((s) => s.kind === 'expansion').sort(byVersion)) {
		const core = cores.find((c) => c.id === e.base);
		if (core)
			out.push({
				value: `${core.id}+${e.id}`,
				label: `${e.name} ${e.version ?? ''} on ${core.name} ${core.version ?? ''}`.trim()
			});
	}
	return out;
}

/**
 * Homebrew to build on, after the official rules: every loaded set the person may see, as its whole chain; from a
 * campaign seat, the sets the campaign allows, on the campaign's rules.
 */
async function homebrewOptions(ctx: Ctx, campaign?: { rules: string; allowed: string[] }) {
	const sets = (await rules.sets(ctx, true)).filter((s) => s.ok && isHomebrewSet(s.id));
	const names = new Map((await rules.listSets(true)).map((s) => [s.id, s]));
	const out: { value: string; label: string }[] = [];
	for (const s of sets) {
		if (campaign && !campaign.allowed.includes(s.id.slice(3))) continue;
		const b = names.get(s.base ?? '');
		const on = b ? `${b.name} ${isHomebrewSet(b.id) ? '' : (b.version ?? '')}`.trim() : s.base;
		out.push({
			value: campaign ? `${campaign.rules}+${s.id}` : (await rules.chainOf(s.id)).join('+'),
			label: `${s.name} (homebrew on ${on})`
		});
	}
	return out;
}

/** The rules a new warband is built for: the given ones, else the newest loaded core version. */
async function pickRules(input: { rulesSet?: string; rulesExpansions?: string[] }) {
	if (input.rulesSet)
		return { rulesSet: input.rulesSet, rulesExpansions: input.rulesExpansions ?? [] };
	const first = (await rulesOptions())[0];
	if (!first) throw new AppError('conflict', 'No rules are loaded yet. Ask an Owner to add them.');
	return { rulesSet: first.value, rulesExpansions: [] };
}

/**
 * What the new-warband wizard offers for one rules choice: the rules to pick from (the loaded versions, then the
 * homebrew the person may see; from a campaign seat, its rules and the homebrew it allows), then each faction with
 * its variants, starting Ducats and the Patrons each may serve. A homebrew pick offers the factions it makes or
 * varies (all of them for a set of items).
 */
export async function choices(
	ctx: Ctx,
	rulesValue?: string,
	campaign?: { rules: string; allowed: string[] }
): Promise<ApiChoices> {
	requireUser(ctx);
	const options = [
		...(campaign
			? (await rulesOptions()).filter((o) => o.value === campaign.rules)
			: await rulesOptions()),
		...(await homebrewOptions(ctx, campaign))
	];
	const picked =
		rulesValue && options.some((o) => o.value === rulesValue) ? rulesValue : options[0]?.value;
	if (!picked) return { rules: [], picked: '', factions: [] };
	const [core, ...exp] = picked.split('+');
	const set = await rules.rulesSetOf(core!, exp);
	const all = mergeSets(set);
	const own = set.manifest.kind === 'homebrew' ? set : null;
	const mine = (id: string) =>
		!own ||
		(!own.factions.length && !own.variants.length) ||
		own.factions.some((f) => f.id === id) ||
		own.variants.some((v) => v.faction === id);
	const playable = all.factions.filter(
		(f) => mine(f.id) && all.units.some((u) => u.owner === f.id && u.category !== 'mercenary')
	);
	return {
		rules: options,
		picked,
		factions: playable.map((fa) => {
			const variants = all.variants.filter((v) => v.faction === fa.id);
			const patrons = Object.fromEntries(
				[undefined, ...variants.map((v) => v.id)].map((v) => [
					v ?? '',
					resolveFaction(set, fa.id, v).patrons.map((p) => ({ id: p.id, name: p.name }))
				])
			);
			return {
				id: fa.id,
				name: fa.name,
				alignment: fa.alignment,
				startDucats: fa.startDucats,
				startGlory: fa.startGlory,
				variants: variants.map((v) => ({
					id: v.id,
					name: v.name,
					startDucats: resolveFaction(set, fa.id, v.id).rules.startDucats
				})),
				patrons
			};
		})
	};
}

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
				const { set, f } = await resolveFor(w, w.factionId, w.variantId);
				const state = stateOf(
					w,
					fighters.filter((x) => x.warbandId === w.id),
					set
				);
				return cardOf(w, { f, state, opts: optionsFor(seat) }, seat);
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
			f = resolveFaction(set, input.factionId, input.variantId);
		} catch {
			throw invalid(input.variantId ? 'variantId' : 'factionId', 'Pick a faction of these rules.');
		}
		if (input.patronId && !f.patrons.some((p) => p.id === input.patronId))
			throw invalid('patronId', 'This warband cannot serve that Patron.');
		const ducatLimit = input.ducatLimit ?? f.rules.startDucats;
		const w = await repo.insert(tx, {
			ownerId: me.id,
			name: input.name,
			...picked,
			factionId: f.faction.id,
			variantId: f.variant?.id ?? null,
			patronId: input.patronId ?? null,
			ducatLimit,
			stashDucats: ducatLimit,
			unspentGlory: f.rules.startGlory
		});
		await record(tx, ctx, 'warband.created', { type: 'warband', id: w.id }, { name: w.name });
		if (at && !at.seat.warbandId) await seatWarband(tx, ctx, at.seat.id, w.id);
		return reloadView(tx, ctx, w.id);
	});
}

/**
 * Import a Trench Companion text export as a new warband for these rules (the newest core when none is given).
 * Names are matched to the rules; what does not match is reported (unmatched), as is kit with more than one source
 * (ambiguous). The list is kept as it was, even if it breaks a limit: the problem list says so.
 */
export async function importText(ctx: Ctx, input: WarbandImport) {
	const me = requireUser(ctx);
	const picked = await pickRules(input);
	await rules.mayUse(ctx, picked.rulesExpansions.filter(isHomebrewSet));
	const set = await rules.rulesSetOf(picked.rulesSet, picked.rulesExpansions);
	let read;
	try {
		read = fromText(input.text, set);
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
			patronId: s.patronId ?? null,
			ducatLimit: s.ducatLimit,
			stashDucats: s.stashDucats,
			unspentGlory: s.unspentGlory,
			stash: s.stash,
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

/** Change the warband's own fields (name, Patron, dedication, limit, banks, notes), with a version check. */
export async function patch(ctx: Ctx, id: string, input: WarbandPatch): Promise<ApiWarband> {
	return db().transaction(async (tx) => {
		const l = await load(tx, ctx, id, { lock: true, edit: true });
		if (l.w.version !== input.version) throw stale();
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
			...(input.notes !== undefined ? { notes: input.notes } : {})
		};
		const after = stateOf({ ...l.w, ...fields }, l.rows, l.set);
		allowChange(l, after);
		if (!(await repo.update(tx, id, fields, input.version))) throw stale();
		return reloadView(tx, ctx, id);
	});
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
