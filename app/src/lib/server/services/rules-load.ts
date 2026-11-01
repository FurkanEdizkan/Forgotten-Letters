/**
 * Loading the rules cache: every mounted folder at start and on the Owner's Reload, and the homebrew sets with them
 * (so a Reload keeps them indexed); one homebrew set, and those built on it, on each save. Each set is checked
 * whole; one that fails is cached with its report and no elements. A homebrew draft that fails is replaced in the
 * cache by its last version that passed (`last_good`), so warbands built on it keep loading; its own report is
 * written back to the homebrew row. Split from `rules.ts`, which reads the cache.
 */
import { createHash } from 'node:crypto';
import { checkSet, readSet, type Problem } from '#lib/rules/check';
import { filesOf, hbSetId, isHomebrewSet, namespaceProblems } from '#lib/rules/homebrew';
import { manifest as manifestSchema } from '#lib/rules/pack';
import type { RuleSetOut } from '#lib/schemas/rules';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import { config } from '../infra/config';
import { logger } from '../infra/logger';
import { readRulesFolders, type RulesFolder } from '../infra/rules-folders';
import * as repo from '../repos/rules';
import * as hbRepo from '../repos/homebrew';
import { record, type Ctx } from './audit';
import { requireUser } from './auth';
import { chain, forgetParsed, listSets } from './rules';

/** What to cache for one set, and the problems of its own files (a homebrew draft's report). */
type Built = repo.BuiltSet & { draft: Problem[] };
/** A folder, or a homebrew set with the files of its last version that passed to fall back on. */
type Folder = RulesFolder & { fallback?: Record<string, unknown> };

/**
 * Check every folder (and homebrew set), bases before the sets built on them; returns what to cache. `seed` gives
 * the chain ids of bases already in the cache (a homebrew save re-checks only its own sets). A set whose files fail
 * is checked again from its fallback, which is cached instead when it passes.
 */
function build(folders: Folder[], seed = new Map<string, Set<string> | null>()): Built[] {
	const manifests = new Map(
		folders.map((f) => [f.folder, manifestSchema.safeParse(f.files['manifest.json']).data ?? null])
	);
	/** The ids of each loaded set's whole chain, by folder; a failed folder maps to null. */
	const done = new Map(seed);
	const out: Built[] = [];
	const check = (f: Folder, files: Record<string, unknown>, problems: Problem[]) => {
		const m = manifestSchema.safeParse(files['manifest.json']).data ?? null;
		const read = readSet(files);
		problems.push(...read.problems);
		const homebrew = isHomebrewSet(f.folder);
		// A homebrew manifest's id is its namespace (hb-<tag>); its cache id is hb:<uuid>.
		if (m && m.id !== f.folder && !homebrew)
			problems.push({
				file: 'manifest.json',
				message: `The manifest's id ${m.id} differs from the folder name ${f.folder}. Make them the same.`
			});
		let baseIds = new Set<string>();
		if (m?.base) {
			const base = done.get(m.base);
			if (base === undefined)
				problems.push({
					file: 'manifest.json',
					message: `The base ${m.base} is not in the rules folder.`
				});
			else if (base === null)
				problems.push({
					file: 'manifest.json',
					message: `The base ${m.base} did not load, so this folder cannot either.`
				});
			else baseIds = base;
		}
		const checked = read.set && !problems.length ? checkSet(read.set, read.fileOf, baseIds) : null;
		if (checked) problems.push(...checked.problems);
		if (homebrew && read.set) problems.push(...namespaceProblems(read.set));
		const ok = !problems.length && !!checked?.checked;
		return { m, problems, baseIds, c: ok ? checked!.checked! : null };
	};
	const one = (f: Folder) => {
		const own = check(f, f.files, [...f.problems]);
		const last = !own.c && f.fallback ? check(f, f.fallback, []) : null;
		const { m, problems, baseIds, c } = last?.c ? last : own;
		const ok = !!c;
		done.set(f.folder, c ? new Set([...baseIds, ...c.elements.map((e) => e.id)]) : null);
		out.push({
			row: {
				id: f.folder,
				name: m?.name ?? f.folder,
				kind: m?.kind ?? null,
				version: m?.version ?? null,
				base: m?.base ?? null,
				checksum: f.checksum,
				report: problems,
				ok
			},
			nodes: c?.elements.map(({ id, type, name, data }) => ({ id, type, name, data })) ?? [],
			edges: c?.edges.map((e) => ({ fromId: e.from, toId: e.to, kind: e.kind })) ?? [],
			draft: own.problems
		});
	};
	let pending = [...folders];
	while (pending.length) {
		const ready = pending.filter((f) => {
			const base = manifests.get(f.folder)?.base;
			return !base || done.has(base) || !manifests.has(base);
		});
		// A loop of bases (a → b → a): check the rest anyway, so each says its base is missing.
		for (const f of ready.length ? ready : pending) one(f);
		pending = pending.filter((f) => !done.has(f.folder));
	}
	return out;
}

/**
 * Read every folder under RULES_DIR (or `dir`), check it and replace the cache in one transaction. At start `ctx`
 * is null; on Reload the Owner's context, and the reload is audited in the same transaction.
 */
export async function loadAll(
	ctx: Ctx | null = null,
	dir = config().RULES_DIR
): Promise<RuleSetOut[]> {
	// A folder named like a homebrew set would collide with one; folders never hold a colon.
	const folders = (await readRulesFolders(dir)).filter((f) => !isHomebrewSet(f.folder));
	let built: Built[] = [];
	await db().transaction(async (tx: Tx) => {
		// Homebrew is read under the lock, so a save meanwhile is either in this load or waits for it.
		await repo.lockCache(tx);
		const homebrew = await hbRepo.all(tx);
		built = build([...folders, ...homebrew.map(hbFolder)]);
		forgetParsed();
		await repo.replaceAll(tx, built);
		await recordChecks(tx, homebrew, built);
		const own = built.filter((b) => !isHomebrewSet(b.row.id));
		if (ctx)
			await record(tx, ctx, 'rules.reloaded', null, {
				loaded: own.filter((b) => b.row.ok).map((b) => b.row.id),
				failed: own.filter((b) => !b.row.ok).map((b) => b.row.id)
			});
	});
	built = built.filter((b) => !isHomebrewSet(b.row.id));
	for (const b of built)
		if (!b.row.ok)
			logger.warn({ folder: b.row.id, problems: b.row.report }, 'Rules folder not loaded');
	logger.info({ dir, sets: built.filter((b) => b.row.ok).length }, 'Rules folders loaded');
	return listSets();
}

/** A homebrew row as a rules folder: its files, a checksum of its data, and its last good version to fall back on. */
const hbFolder = (r: hbRepo.HomebrewRow): Folder => ({
	folder: hbSetId(r.id),
	files: filesOf(r.data),
	checksum: createHash('sha256').update(JSON.stringify(r.data)).digest('hex'),
	problems: [],
	...(r.lastGood && r.lastGood.version !== r.version ? { fallback: filesOf(r.lastGood.data) } : {})
});

/**
 * Write each homebrew row's own report back, and make a version that passes its new last good one (so a later
 * broken draft falls back to it). Rows that did not change are left alone.
 */
async function recordChecks(tx: Tx, rows: hbRepo.HomebrewRow[], built: Built[]) {
	for (const r of rows) {
		const b = built.find((x) => x.row.id === hbSetId(r.id));
		if (!b) continue;
		const lastGood =
			!b.draft.length && r.lastGood?.version !== r.version
				? { data: r.data, version: r.version, checkedAt: new Date().toISOString() }
				: undefined;
		if (lastGood || JSON.stringify(r.report) !== JSON.stringify(b.draft))
			await hbRepo.setCheck(tx, r.id, { report: b.draft, ...(lastGood ? { lastGood } : {}) });
	}
}

/** The ids of a loaded set's whole chain, or null when it is not loaded. */
async function chainIds(tx: Tx, setId: string) {
	try {
		return new Set(await repo.nodeIds(tx, await chain(setId, tx)));
	} catch {
		return null;
	}
}

/**
 * Check a homebrew set, and the homebrew sets built on it, over their bases and replace them in the cache: indexed
 * when they pass (becoming their last good version), else indexed from their last good version, else kept with
 * their report. In the caller's transaction, under the cache lock.
 */
export async function indexHomebrew(tx: Tx, uuid: string) {
	await repo.lockCache(tx);
	// ponytail: reads every homebrew row to find the ones built on this; a recursive query if groups make hundreds.
	const all = await hbRepo.all(tx);
	const ids = new Set([hbSetId(uuid)]);
	for (let grew = true; grew;) {
		grew = false;
		for (const r of all)
			if (ids.has(r.baseSet) && !ids.has(hbSetId(r.id))) {
				ids.add(hbSetId(r.id));
				grew = true;
			}
	}
	const rows = all.filter((r) => ids.has(hbSetId(r.id)));
	const seed = new Map<string, Set<string> | null>();
	for (const b of new Set(rows.map((r) => r.baseSet)))
		if (!ids.has(b)) seed.set(b, await chainIds(tx, b));
	const built = build(rows.map(hbFolder), seed);
	await repo.replaceSets(tx, built);
	await recordChecks(tx, rows, built);
	forgetParsed();
}

/** Take a homebrew set out of the cache (it was deleted). */
export async function unindexHomebrew(tx: Tx, uuid: string) {
	await repo.lockCache(tx);
	await repo.removeSet(tx, hbSetId(uuid));
	forgetParsed();
}

/** Read the rules folders again (Owner only), replacing the cache; answers the sets with their reports. */
export async function reload(ctx: Ctx): Promise<RuleSetOut[]> {
	const me = requireUser(ctx);
	if (me.role !== 'owner')
		throw new AppError('forbidden', 'Only an owner can reload the rules folders.');
	return loadAll(ctx);
}
