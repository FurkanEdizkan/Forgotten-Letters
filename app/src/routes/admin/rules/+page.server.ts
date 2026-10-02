import { allVersions, versionById } from '$lib/server/versions';
import { diff } from '$lib/rules-versions';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { rulesFaction, rulesItem, rulesKeyword, rulesPage, rulesUnit } from '$lib/server/db/schema';
import { allFactionRules, allKeywords, importRules, itemsOf, pagesOf, rulesSummary, unitsOf } from '$lib/server/rules-data';
import { FACTIONS } from '$lib/rules/factions';
import { loadPacks, readPacks } from '$lib/server/packs';
import type { Actions, PageServerLoad } from './$types';

const RULE_FACTIONS = [...FACTIONS.map((f) => ({ id: f.id, name: f.name })), { id: 'mercenaries', name: 'Mercenaries' }];

export const load: PageServerLoad = async ({ url }) => {
	const f = url.searchParams.get('f') ?? '';
	const todo = url.searchParams.has('todo');
	const summary = await rulesSummary();
	const book = (['core', 'campaign', 'scenario'] as const).find((b) => f === `pages-${b}`);
	const isFaction = RULE_FACTIONS.some((x) => x.id === f);
	const pick = <T extends { verified: boolean }>(rows: T[]) => (todo ? rows.filter((r) => !r.verified) : rows);
	// Rules versions, newest first; one picked (`?version=`) is compared with the one before it.
	const versions = await allVersions();
	const picked = url.searchParams.get('version');
	const k = versions.findIndex((v) => v.id === picked);
	const compare =
		k >= 0 && versions[k + 1]
			? await Promise.all([versionById(versions[k + 1].id), versionById(versions[k].id)]).then(([a, b]) => (a && b ? diff(a.snapshot, b.snapshot) : []))
			: null;
	return {
		versions: versions.map((v) => ({ id: v.id, label: v.label, kind: v.kind, at: v.createdAt.toISOString() })),
		compare: compare && { id: picked, changes: compare },
		factions: RULE_FACTIONS.map((x) => ({
			...x,
			units: summary.units.find((u) => u.faction === x.id)?.n ?? 0,
			unverified: summary.units.find((u) => u.faction === x.id)?.unverified ?? 0,
			items: summary.items.find((i) => i.faction === x.id)?.n ?? 0
		})),
		keywordCount: summary.keywords,
		books: (['core', 'campaign', 'scenario'] as const).map((b) => ({
			id: b,
			pages: summary.pages.find((p) => p.book === b)?.n ?? 0,
			unverified: summary.pages.find((p) => p.book === b)?.unverified ?? 0
		})),
		selected: f,
		todo,
		units: isFaction ? pick(await unitsOf(f)) : [],
		items: isFaction ? pick(await itemsOf(f)) : [],
		keywords: f === 'keywords' ? pick(await allKeywords()) : [],
		pages: book ? pick(await pagesOf(book)) : [],
		factionRules: f === 'faction-rules' ? pick(await allFactionRules()) : []
	};
};

const str = (d: FormData, k: string, max = 4000) => String(d.get(k) ?? '').trim().slice(0, max) || null;
const num = (d: FormData, k: string) => (String(d.get(k) ?? '').trim() === '' ? null : Math.max(0, Math.round(Number(d.get(k)) || 0)));
const list = (d: FormData, k: string) =>
	String(d.get(k) ?? '')
		.split(',')
		.map((s) => s.trim().toUpperCase())
		.filter(Boolean);

export const actions: Actions = {
	// Book packs (Faction Studio YAML, several at once): they become the book; the CM's Studio edits stay.
	packs: async ({ request }) => {
		const files = (await request.formData()).getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
		if (!files.length) return fail(400, { packsMessage: 'Choose one or more pack files (.yaml).' });
		const { packs, errors } = readPacks(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))));
		if (errors.length) return fail(400, { packsMessage: `Nothing loaded: ${errors.slice(0, 12).join(' · ')}${errors.length > 12 ? ` · and ${errors.length - 12} more` : ''}` });
		return { packsLoaded: await loadPacks(packs) };
	},
	import: async ({ request }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || !file.size) return fail(400, { importMessage: 'Choose the rules.json file made by import-rules.py.' });
		try {
			const r = await importRules(JSON.parse(await file.text()));
			return { imported: r };
		} catch (e) {
			return fail(400, { importMessage: (e as Error).message });
		}
	},

	unit: async ({ request }) => {
		const d = await request.formData();
		const id = String(d.get('id'));
		await db
			.update(rulesUnit)
			.set({
				name: str(d, 'name', 120) ?? 'Unnamed',
				cost: num(d, 'cost') ?? 0,
				currency: d.get('currency') === 'glory' ? 'glory' : 'ducats',
				category: (['elite', 'troop', 'mercenary'] as const).find((c) => c === d.get('category')) ?? 'troop',
				availabilityMin: num(d, 'min') ?? 0,
				availabilityMax: num(d, 'max'),
				stats: Object.fromEntries(['movement', 'ranged', 'melee', 'armour', 'base'].map((k) => [k, str(d, k, 30)]).filter(([, v]) => v)),
				keywords: list(d, 'keywords'),
				abilities: String(d.get('abilities') ?? '')
					.split(/\n\s*\n|\n(?=[^\n:]{2,80}:)/)
					.map((block) => block.trim())
					.filter(Boolean)
					.map((block) => {
						const [name, ...rest] = block.split(':');
						return { name: name.trim(), text: rest.join(':').trim() };
					}),
				battlekitNote: str(d, 'battlekitNote', 600),
				powers: str(d, 'powers', 1000),
				description: str(d, 'description'),
				verified: d.has('verified')
			})
			.where(eq(rulesUnit.id, id));
		return { saved: id };
	},

	item: async ({ request }) => {
		const d = await request.formData();
		const id = String(d.get('id'));
		await db
			.update(rulesItem)
			.set({
				name: str(d, 'name', 120) ?? 'Item',
				cost: num(d, 'cost') ?? 0,
				currency: d.get('currency') === 'glory' ? 'glory' : 'ducats',
				limit: num(d, 'limit'),
				restrictions: str(d, 'restrictions', 200),
				type: str(d, 'type', 60),
				range: str(d, 'range', 60),
				keywords: list(d, 'keywords'),
				text: str(d, 'text'),
				verified: d.has('verified')
			})
			.where(eq(rulesItem.id, id));
		return { saved: id };
	},

	page: async ({ request }) => {
		const d = await request.formData();
		const slug = String(d.get('slug'));
		await db
			.update(rulesPage)
			.set({ title: str(d, 'title', 160) ?? 'Untitled', body: str(d, 'body', 200_000) ?? '', verified: d.has('verified') })
			.where(eq(rulesPage.slug, slug));
		return { saved: slug };
	},

	factionRule: async ({ request }) => {
		const d = await request.formData();
		const id = String(d.get('id'));
		await db
			.update(rulesFaction)
			.set({ text: str(d, 'text', 20_000) ?? '', verified: d.has('verified') })
			.where(eq(rulesFaction.id, id));
		return { saved: id };
	},

	keyword: async ({ request }) => {
		const d = await request.formData();
		const name = String(d.get('name'));
		await db
			.update(rulesKeyword)
			.set({ text: str(d, 'text') ?? '', verified: d.has('verified') })
			.where(eq(rulesKeyword.name, name));
		return { saved: name };
	}
};
