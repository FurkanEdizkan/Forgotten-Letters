import { existsSync, readFileSync } from 'node:fs';
import { asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { rulesFaction, rulesItem, rulesKeyword, rulesPage, rulesUnit } from './db/schema';

type Unit = typeof rulesUnit.$inferInsert;
type Item = typeof rulesItem.$inferInsert;

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : null) || null;
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter((x): x is string => !!x).slice(0, 40) : []);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);

const UNIT_CATS = ['elite', 'troop', 'mercenary'] as const;
const ITEM_CATS = ['ranged', 'melee', 'grenade', 'armour', 'shield', 'equipment', 'special'] as const;
const CURRENCIES = ['ducats', 'glory'] as const;
const BOOKS = ['core', 'campaign', 'scenario'] as const;

function pageRow(p: any, i: number): typeof rulesPage.$inferInsert | null {
	const slug = str(p?.slug, 160);
	const title = str(p?.title, 160);
	const body = str(p?.body, 200_000);
	if (!slug || !title || !body) return null;
	return {
		slug,
		book: oneOf(p.book, BOOKS, 'core'),
		chapter: str(p.chapter, 120) ?? title,
		title,
		order: Number.isFinite(Number(p.order)) ? Number(p.order) : i,
		body,
		// Only WebP data URLs from import-rules.py, a few per page and none too large.
		maps: (Array.isArray(p.maps) ? p.maps : [])
			.filter((m: any) => typeof m?.src === 'string' && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(m.src) && m.src.length < 800_000)
			.slice(0, 8)
			.map((m: any) => ({ src: m.src as string, width: int(m.width), height: int(m.height) })),
		source: str(p.source, 120),
		page: str(String(p.page ?? ''), 10)
	};
}

function unitRow(u: any): Unit | null {
	const id = str(u?.id, 160);
	const name = str(u?.name, 120);
	if (!id || !name || !str(u?.faction)) return null;
	return {
		id,
		faction: str(u.faction, 60)!,
		variant: str(u.variant, 120),
		name,
		category: oneOf(u.category, UNIT_CATS, 'troop'),
		availabilityMin: int(u.availability?.min),
		availabilityMax: u.availability?.max == null ? null : int(u.availability.max),
		cost: int(u.cost),
		currency: oneOf(u.currency, CURRENCIES, 'ducats'),
		stats: Object.fromEntries(
			['movement', 'ranged', 'melee', 'armour', 'base'].map((k) => [k, str(u.stats?.[k], 30)]).filter(([, v]) => v)
		),
		keywords: strs(u.keywords),
		abilities: (Array.isArray(u.abilities) ? u.abilities : [])
			.map((a: any) => ({ name: str(a?.name, 120) ?? '', text: str(a?.text, 4000) ?? '' }))
			.filter((a: { name: string }) => a.name)
			.slice(0, 20),
		battlekitNote: str(u.battlekitNote, 600),
		powers: str(u.powers, 1000),
		description: str(u.description, 4000),
		page: str(String(u.page ?? ''), 10)
	};
}

function itemRow(i: any): Item | null {
	const name = str(i?.name, 120);
	const faction = str(i?.faction, 60);
	if (!name || !faction) return null;
	const variant = str(i.variant, 120);
	return {
		id: `${faction}:${variant ?? ''}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		faction,
		variant,
		category: oneOf(i.category, ITEM_CATS, 'equipment'),
		name,
		unique: !!i.unique,
		cost: int(i.cost),
		currency: oneOf(i.currency, CURRENCIES, 'ducats'),
		limit: i.limit == null ? null : int(i.limit),
		restrictions: str(i.restrictions, 200),
		type: str(i.type, 60),
		range: str(i.range, 60),
		keywords: strs(i.keywords),
		text: str(i.text, 4000),
		description: str(i.description, 4000)
	};
}

/**
 * Load an import-rules.py file. Entries the CM has verified are left alone; everything else is
 * replaced. Returns what changed.
 */
export async function importRules(data: unknown) {
	const d = data as { units?: unknown[]; items?: unknown[]; keywords?: unknown[]; pages?: unknown[]; rules?: unknown[] };
	if (!d || !Array.isArray(d.units) || !Array.isArray(d.items)) throw new Error('Not an import-rules.py file');
	const units = d.units.map(unitRow).filter((u): u is Unit => !!u);
	const items = d.items.map(itemRow).filter((i): i is Item => !!i);
	const keywords = (Array.isArray(d.keywords) ? d.keywords : [])
		.map((k: any) => ({ name: str(k?.name, 80), kind: str(k?.kind, 20), text: str(k?.text, 4000) }))
		.filter((k): k is { name: string; kind: string | null; text: string } => !!k.name && !!k.text);
	const pages = (Array.isArray(d.pages) ? d.pages : []).map(pageRow).filter((p): p is typeof rulesPage.$inferInsert => !!p);
	type FactionRule = { id: string; faction: string; variant: string | null; text: string; page: string | null };
	const factionRules: FactionRule[] = [];
	for (const r of (Array.isArray(d.rules) ? d.rules : []) as any[]) {
		const faction = str(r?.faction, 60);
		const variant = str(r?.variant, 120);
		const text = str(r?.text, 20_000);
		if (faction && text) factionRules.push({ id: `${faction}:${variant ?? ''}`, faction, variant, text, page: str(String(r.page ?? ''), 10) });
	}
	const n = { units: 0, items: 0, keywords: 0, pages: 0, rules: 0, kept: 0 };
	await db.transaction(async (tx) => {
		const keep = async <T extends { id?: string; name?: string; slug?: string }>(
			rows: T[],
			table: typeof rulesUnit | typeof rulesItem | typeof rulesKeyword | typeof rulesPage | typeof rulesFaction,
			key: 'id' | 'name' | 'slug'
		) => {
			const verified = new Set(
				(await tx.select().from(table as typeof rulesUnit).where(eq((table as typeof rulesUnit).verified, true))).map((r: any) => r[key])
			);
			n.kept += verified.size;
			return rows.filter((r: any) => !verified.has(r[key]));
		};
		const u = await keep(units, rulesUnit, 'id');
		await tx.delete(rulesUnit).where(eq(rulesUnit.verified, false));
		for (const row of u) await tx.insert(rulesUnit).values(row).onConflictDoNothing();
		n.units = u.length;
		const it = await keep(items, rulesItem, 'id');
		await tx.delete(rulesItem).where(eq(rulesItem.verified, false));
		for (const row of it) await tx.insert(rulesItem).values(row).onConflictDoNothing();
		n.items = it.length;
		const kw = await keep(keywords, rulesKeyword, 'name');
		await tx.delete(rulesKeyword).where(eq(rulesKeyword.verified, false));
		for (const row of kw) await tx.insert(rulesKeyword).values(row).onConflictDoNothing();
		n.keywords = kw.length;
		if (factionRules.length) {
			const fr = await keep(factionRules, rulesFaction, 'id');
			await tx.delete(rulesFaction).where(eq(rulesFaction.verified, false));
			for (const row of fr) await tx.insert(rulesFaction).values(row).onConflictDoNothing();
			n.rules = fr.length;
		}
		// An older file without pages leaves the pages already loaded alone.
		if (pages.length) {
			const pg = await keep(pages, rulesPage, 'slug');
			await tx.delete(rulesPage).where(eq(rulesPage.verified, false));
			for (const row of pg) await tx.insert(rulesPage).values(row).onConflictDoNothing();
			n.pages = pg.length;
		}
	});
	return n;
}

/** On first start, load `/data/rules.json` if the tables are empty and the file is there. */
export async function loadRulesFileIfEmpty() {
	const path = env.RULES_FILE ?? '/data/rules.json';
	if (!existsSync(path)) return;
	const [{ n }] = await db.select({ n: count() }).from(rulesUnit);
	if (n > 0) return;
	const r = await importRules(JSON.parse(readFileSync(path, 'utf8')));
	console.log(`Loaded rules from ${path}: ${r.units} units, ${r.items} items, ${r.keywords} keywords, ${r.pages} pages.`);
}

export async function rulesSummary() {
	const units = await db
		.select({ faction: rulesUnit.faction, n: count(), unverified: sql<number>`count(*) filter (where not ${rulesUnit.verified})::int` })
		.from(rulesUnit)
		.groupBy(rulesUnit.faction);
	const items = await db.select({ faction: rulesItem.faction, n: count() }).from(rulesItem).groupBy(rulesItem.faction);
	const [{ keywords }] = await db.select({ keywords: count() }).from(rulesKeyword);
	const pages = await db
		.select({ book: rulesPage.book, n: count(), unverified: sql<number>`count(*) filter (where not ${rulesPage.verified})::int` })
		.from(rulesPage)
		.groupBy(rulesPage.book);
	return { units, items, keywords, pages };
}

export const unitsOf = (faction: string) =>
	db.select().from(rulesUnit).where(eq(rulesUnit.faction, faction)).orderBy(asc(rulesUnit.category), asc(rulesUnit.cost));
export const itemsOf = (faction: string) =>
	db.select().from(rulesItem).where(eq(rulesItem.faction, faction)).orderBy(asc(rulesItem.category), asc(rulesItem.name));
export const allKeywords = () => db.select().from(rulesKeyword).orderBy(asc(rulesKeyword.name));

/** The contents of the rules pages (no bodies), in book order. */
export const pageIndex = () =>
	db
		.select({ slug: rulesPage.slug, book: rulesPage.book, chapter: rulesPage.chapter, title: rulesPage.title, verified: rulesPage.verified })
		.from(rulesPage)
		.orderBy(asc(rulesPage.order));
export const rulePage = async (slug: string) => (await db.select().from(rulesPage).where(eq(rulesPage.slug, slug)))[0] ?? null;
export const pagesOf = (book: 'core' | 'campaign' | 'scenario') =>
	db.select().from(rulesPage).where(eq(rulesPage.book, book)).orderBy(asc(rulesPage.order));

export async function searchRules(q: string) {
	const like = `%${q.replace(/[%_]/g, '')}%`;
	const [units, items, keywords, pages] = await Promise.all([
		db
			.select()
			.from(rulesUnit)
			.where(or(ilike(rulesUnit.name, like), sql`${rulesUnit.keywords}::text ilike ${like}`, sql`${rulesUnit.abilities}::text ilike ${like}`))
			.limit(40),
		db.select().from(rulesItem).where(or(ilike(rulesItem.name, like), ilike(rulesItem.text, like))).limit(40),
		db.select().from(rulesKeyword).where(or(ilike(rulesKeyword.name, like), ilike(rulesKeyword.text, like))).limit(40),
		db
			.select({ slug: rulesPage.slug, book: rulesPage.book, title: rulesPage.title, chapter: rulesPage.chapter, body: rulesPage.body })
			.from(rulesPage)
			.where(or(ilike(rulesPage.title, like), ilike(rulesPage.body, like)))
			.orderBy(asc(rulesPage.order))
			.limit(40)
	]);
	// A line of context around the first hit instead of the whole page.
	const needle = q.toLowerCase();
	const snip = pages.map(({ body, ...p }) => {
		const at = body.toLowerCase().indexOf(needle);
		const from = Math.max(0, at - 80);
		return { ...p, snippet: at < 0 ? body.slice(0, 160) : (from ? '…' : '') + body.slice(from, at + needle.length + 100).replace(/^#+ |\n+/g, ' ') + '…' };
	});
	return { units, items, keywords, pages: snip };
}

/** A faction's rules and (when given) its variant's, as printed. */
export async function factionRulesText(faction: string, variant: string | null) {
	const rows = await db.select().from(rulesFaction).where(eq(rulesFaction.faction, faction));
	const f = rows.find((r) => !r.variant);
	const v = variant ? rows.find((r) => r.variant === variant) : undefined;
	return { faction: f?.text ?? null, variant: v?.text ?? null, overrides: [f?.overrides ?? null, v?.overrides ?? null] };
}
export const allFactionRules = () => db.select().from(rulesFaction).orderBy(asc(rulesFaction.faction), asc(rulesFaction.variant));
