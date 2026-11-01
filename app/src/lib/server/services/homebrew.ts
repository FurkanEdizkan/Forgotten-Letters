/**
 * Homebrew: any signed-in player makes their own faction, variant (of an official or homebrew faction) or set of
 * items, blank or from a copy, in the rules folder format. Every save checks the whole set and re-indexes it in the
 * rules cache as `hb:<id>` (an invalid draft saves with its report, and the cache keeps serving the last version that
 * passed, so warbands built on it keep loading), so the compendium, graph and warband builder use it like any rules
 * set. Private until its maker shares it with the install; exported and
 * imported as one JSON object of the folder's files. Campaigns allow homebrew through the campaign settings.
 */
import {
	blankSet,
	copySet,
	filesOf,
	hbSetId,
	manifestFor,
	namespaceOf,
	newTag,
	renamespace,
	setOfFiles,
	type HomebrewKind
} from '#lib/rules/homebrew';
import {
	homebrewData,
	type ApiHomebrew,
	type ApiHomebrewCard,
	type HomebrewCreate,
	type HomebrewImport,
	type HomebrewUpdate
} from '#lib/schemas/homebrew';
import { setId as setIdSchema, type RuleSetOut } from '#lib/schemas/rules';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/homebrew';
import { record, type Ctx, type SessionUser } from './audit';
import { requireUser } from './auth';
import * as rules from './rules';

const notFound = () => new AppError('not_found', 'No such homebrew set.');
const stale = () =>
	new AppError(
		'conflict',
		'Someone saved this homebrew set a moment ago. Reload to see the change, then try again.'
	);
const invalid = (field: string, message: string) =>
	new AppError('invalid', message, { [field]: message });
const target = (id: string) => ({ type: 'homebrew', id });

/** Its maker, anyone once shared, and Owners. */
const canSee = (me: SessionUser, h: repo.HomebrewRow) =>
	h.ownerId === me.id || h.visibility === 'shared' || me.role === 'owner';

async function load(tx: Tx, ctx: Ctx, id: string, edit = false) {
	const me = requireUser(ctx);
	const h = await (edit ? repo.lock(tx, id) : repo.findById(tx, id));
	if (!h || !canSee(me, h)) throw notFound();
	if (edit && h.ownerId !== me.id)
		throw new AppError('forbidden', 'Only its maker can change a homebrew set.');
	return { me, h };
}

const label = (s: RuleSetOut | undefined, fallback: string) =>
	s ? `${s.name} ${isHb(s.id) ? '' : (s.version ?? '')}`.trim() : fallback;
const isHb = (id: string) => id.startsWith('hb:');

async function setsById() {
	return new Map((await rules.listSets(true)).map((s) => [s.id, s]));
}

function cardOf(
	h: repo.HomebrewView,
	me: SessionUser,
	sets: Map<string, RuleSetOut>
): ApiHomebrewCard {
	const s = sets.get(hbSetId(h.id));
	return {
		id: h.id,
		setId: hbSetId(h.id),
		name: h.name,
		kind: h.kind,
		baseSet: h.baseSet,
		baseName: label(sets.get(h.baseSet), h.baseSet),
		visibility: h.visibility,
		ownerId: h.ownerId,
		ownerName: h.ownerName,
		mine: h.ownerId === me.id,
		ok: !h.report.length,
		problems: h.report.length,
		// What players build with: the last version that passed, while it is in the cache.
		published:
			s?.ok && h.lastGood ? { version: h.lastGood.version, checkedAt: h.lastGood.checkedAt } : null,
		version: h.version,
		updatedAt: h.updatedAt.toISOString()
	};
}

// ---------------------------------------------------------------- reading

/** My homebrew sets, and the ones others shared, by name. */
export async function list(ctx: Ctx) {
	const me = requireUser(ctx);
	const [rows, sets] = await Promise.all([repo.listFor(db(), me.id), setsById()]);
	const cards = rows.map((h) => cardOf(h, me, sets));
	return { mine: cards.filter((c) => c.mine), shared: cards.filter((c) => !c.mine) };
}

/** One set with its data and its check report: its maker, anyone once shared, Owners. */
export async function get(ctx: Ctx, id: string): Promise<ApiHomebrew> {
	const { me, h } = await load(db(), ctx, id);
	const sets = await setsById();
	return {
		...cardOf(h as repo.HomebrewView, me, sets),
		data: h.data,
		report: h.report,
		copiedFrom: h.copiedFrom
	};
}

/**
 * The sets a CM may tick in a campaign's settings: every loaded set they can see, plus the ones the campaign
 * already allows (shown even when the CM cannot see them, so saving the settings never drops another's choice).
 */
export async function allowable(ctx: Ctx, allowed: string[]) {
	const { mine, shared } = await list(ctx);
	const sets = await setsById();
	const out = [...mine, ...shared]
		.filter((c) => c.published)
		.map((c) => ({ id: c.id, name: c.name, baseName: c.baseName, ownerName: c.ownerName }));
	for (const id of allowed)
		if (!out.some((o) => o.id === id)) {
			const s = sets.get(hbSetId(id));
			out.push({
				id,
				name: s?.name ?? id,
				baseName: label(sets.get(s?.base ?? ''), ''),
				ownerName: ''
			});
		}
	return out;
}

/** The set as one JSON object of its folder's files, to save as a .json file. */
export async function exportOf(ctx: Ctx, id: string) {
	const { h } = await load(db(), ctx, id);
	return { body: JSON.stringify(filesOf(h.data), null, '\t'), name: h.name };
}

// ---------------------------------------------------------------- creating

const kindOf = (set: Record<string, unknown>): HomebrewKind =>
	(set.factions as unknown[] | undefined)?.length
		? 'faction'
		: (set.variants as unknown[] | undefined)?.length
			? 'variant'
			: 'items';

/** Insert and index a set, audited; answers it as read after the commit (with its check report). */
async function insert(
	ctx: Ctx,
	row: Omit<Parameters<typeof repo.insert>[1], 'ownerId'>,
	action: 'homebrew.created' | 'homebrew.imported',
	refuseInvalid = false
) {
	const me = requireUser(ctx);
	const id = await db().transaction(async (tx) => {
		const h = await repo.insert(tx, { ...row, ownerId: me.id });
		await rules.indexHomebrew(tx, h.id);
		const checked = await repo.lock(tx, h.id);
		if (refuseInvalid && checked?.report.length) {
			const problems = checked.report;
			throw new AppError(
				'invalid',
				`The file does not pass its checks (${problems.length} problem${problems.length === 1 ? '' : 's'}).`,
				Object.fromEntries(
					problems
						.slice(0, 20)
						.map((p, i) => [`problem${i + 1}`, `${p.file}${p.id ? ` ${p.id}` : ''}: ${p.message}`])
				)
			);
		}
		await record(tx, ctx, action, target(h.id), { name: h.name, copiedFrom: h.copiedFrom });
		return h.id;
	});
	return get(ctx, id);
}

/**
 * Make a set on a rules set the maker can see: a blank faction (starting values to change), a blank variant of a
 * faction, a blank set of items, or a copy of a faction or variant (its units, armoury lines and upgrades cloned
 * under new ids).
 */
export async function create(ctx: Ctx, input: HomebrewCreate): Promise<ApiHomebrew> {
	requireUser(ctx);
	const tag = newTag();
	const at = { name: input.name, base: input.base, tag };
	if (input.start === 'copy') {
		const els = await rules.elements(ctx, input.base, [
			'faction',
			'variant',
			'unit',
			'line',
			'upgrade'
		]);
		let made;
		try {
			made = copySet(els, input.of!, at);
		} catch {
			throw invalid('of', 'Pick a faction or variant of these rules.');
		}
		return insert(
			ctx,
			{
				name: input.name,
				kind: made.kind,
				baseSet: input.base,
				data: made.set,
				copiedFrom: input.of!
			},
			'homebrew.created'
		);
	}
	if (input.start === 'variant') {
		const factions = await rules.elements(ctx, input.base, ['faction']);
		if (!factions.some((f) => f.id === input.of && f.id !== 'faction:mercenaries'))
			throw invalid('of', 'Pick a faction of these rules.');
	} else await rules.mayUse(ctx, [input.base]);
	const data = blankSet({ ...at, kind: input.start, faction: input.of });
	return insert(
		ctx,
		{ name: input.name, kind: input.start, baseSet: input.base, data },
		'homebrew.created'
	);
}

/**
 * Import an exported set as a new one of mine: its base must be loaded and visible to me, it gets a namespace of
 * its own (so importing twice never clashes), and it must pass its checks (refused with the problems otherwise).
 */
export async function importSet(ctx: Ctx, input: HomebrewImport): Promise<ApiHomebrew> {
	requireUser(ctx);
	const raw = setOfFiles(input.files);
	const m = (raw.manifest ?? {}) as { base?: unknown; name?: unknown };
	const base = typeof m.base === 'string' ? m.base : '';
	if (!setIdSchema.safeParse(base).success)
		throw invalid('files', 'The manifest names no base rules set. Export the set again.');
	await rules.mayUse(ctx, [base]);
	const name =
		input.name ||
		(typeof m.name === 'string' ? m.name.trim().slice(0, 80) : '') ||
		'Imported homebrew';
	const data = homebrewData.safeParse(renamespace(raw, newTag(), name, base));
	if (!data.success) throw invalid('files', 'That is not an exported homebrew set.');
	return insert(
		ctx,
		{ name, kind: kindOf(data.data), baseSet: base, data: data.data },
		'homebrew.imported',
		true
	);
}

// ---------------------------------------------------------------- changing

/**
 * Save the whole set, with a version check. The manifest is the service's (namespace, name, base, version); the rest
 * is checked whole and re-indexed, and an invalid draft is saved with its report.
 */
export async function update(ctx: Ctx, id: string, input: HomebrewUpdate): Promise<ApiHomebrew> {
	await db().transaction(async (tx) => {
		const { h } = await load(tx, ctx, id, true);
		if (h.version !== input.version) throw stale();
		const name = input.name ?? h.name;
		const tag = namespaceOf(h.data).replace(/^hb-/, '');
		const data = { ...input.data, manifest: manifestFor(tag, name, h.baseSet, h.version + 1) };
		if (!(await repo.update(tx, id, { name, data }, input.version))) throw stale();
		await rules.indexHomebrew(tx, id);
		await record(tx, ctx, 'homebrew.updated', target(id), { name });
	});
	return get(ctx, id);
}

const named = (what: string, names: string[]) =>
	names.length ? `${what} ${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}` : '';
const inUse = (parts: string[], fix: string) =>
	new AppError('conflict', `In use by ${parts.filter(Boolean).join('; ')}. ${fix}`);

/**
 * Share the set with everyone on the install, or make it private again. Sharing needs its homebrew base shared
 * first; making it private is refused while other people's warbands or sets build on it.
 */
export async function share(ctx: Ctx, id: string, on: boolean): Promise<ApiHomebrew> {
	await db().transaction(async (tx) => {
		const { me, h } = await load(tx, ctx, id, true);
		if (on && isHb(h.baseSet)) {
			const base = await repo.findById(tx, h.baseSet.slice(3));
			if (base && base.visibility !== 'shared')
				throw new AppError('conflict', `Share ${base.name} first: this set builds on it.`);
		}
		if (!on) {
			const u = await repo.usage(tx, id, me.id);
			const others = (await repo.builtOn(tx, hbSetId(id)))
				.filter((s) => s.ownerId !== me.id || s.visibility === 'shared')
				.map((s) => s.name);
			if (u.warbands.length || others.length)
				throw inUse(
					[named('warbands', u.warbands), named('homebrew sets', others)],
					'Others build on it, so it stays shared.'
				);
		}
		await repo.update(tx, id, { visibility: on ? 'shared' : 'private' });
		await record(tx, ctx, on ? 'homebrew.shared' : 'homebrew.unshared', target(id));
	});
	return get(ctx, id);
}

/** Delete a set for good (its maker or an Owner); refused while warbands or other sets build on it. */
export async function remove(ctx: Ctx, id: string): Promise<void> {
	await db().transaction(async (tx) => {
		const me = requireUser(ctx);
		const h = await repo.lock(tx, id);
		if (!h || !canSee(me, h)) throw notFound();
		if (h.ownerId !== me.id && me.role !== 'owner')
			throw new AppError('forbidden', 'Only its maker or an Owner can delete a homebrew set.');
		const u = await repo.usage(tx, id);
		if (u.warbands.length || u.sets.length)
			throw inUse(
				[named('warbands', u.warbands), named('homebrew sets', u.sets)],
				'Delete or move those first.'
			);
		await repo.remove(tx, [id]);
		await rules.unindexHomebrew(tx, id);
		await record(tx, ctx, 'homebrew.deleted', target(id), { name: h.name });
	});
}

/**
 * An account is anonymised: its private homebrew goes, unless warbands or sets still build on it; shared sets
 * stay for the people using them, their maker shown as "Former member". In the caller's transaction, after the
 * account's own warbands are removed.
 */
export async function removeAllOf(tx: Tx, userId: string) {
	for (const h of await repo.ofOwner(tx, userId)) {
		if (h.visibility === 'shared') continue;
		const u = await repo.usage(tx, h.id);
		if (u.warbands.length || u.sets.length) continue;
		await repo.remove(tx, [h.id]);
		await rules.unindexHomebrew(tx, h.id);
	}
}
