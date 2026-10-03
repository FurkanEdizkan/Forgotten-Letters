import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { rulesFaction, rulesItem, rulesKeyword, rulesUnit } from '$lib/server/db/schema';
import { studioEdition } from '$lib/server/editions';
import { removeKeyword, saveKeyword } from '$lib/server/studio';
import { explain, keywordKey } from '$lib/keywords';
import type { RulesOverride } from '$lib/warband-rules';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['Tag', 'Effect', 'Tag, Effect'];

/** Every keyword the edition's units, kit and upgrades carry, with who carries it. */
async function usage(edition: string) {
	const [units, items, rules] = await Promise.all([
		db.select({ name: rulesUnit.name, keywords: rulesUnit.keywords }).from(rulesUnit).where(eq(rulesUnit.edition, edition)),
		db.select({ name: rulesItem.name, keywords: rulesItem.keywords }).from(rulesItem).where(eq(rulesItem.edition, edition)),
		db.select({ overrides: rulesFaction.overrides }).from(rulesFaction).where(eq(rulesFaction.edition, edition))
	]);
	const used = new Map<string, { units: string[]; items: string[]; upgrades: string[] }>();
	const add = (k: string, kind: 'units' | 'items' | 'upgrades', who: string) => {
		const u = used.get(k) ?? { units: [], items: [], upgrades: [] };
		if (!u[kind].includes(who)) u[kind].push(who);
		used.set(k, u);
	};
	for (const u of units) for (const k of u.keywords) add(k.toUpperCase(), 'units', u.name);
	for (const i of items) for (const k of i.keywords) add(k.toUpperCase(), 'items', i.name);
	for (const r of rules)
		for (const up of (r.overrides as RulesOverride | null)?.upgrades ?? []) for (const k of [up.keyword, ...(up.keywords ?? [])]) if (k) add(k.toUpperCase(), 'upgrades', up.name);
	return used;
}

export const load: PageServerLoad = async ({ url, cookies }) => {
	const edition = await studioEdition({ url, cookies });
	const [rows, used] = await Promise.all([db.select().from(rulesKeyword).where(eq(rulesKeyword.edition, edition)), usage(edition)]);
	const glossary = Object.fromEntries(rows.map((k) => [keywordKey(k.name), k.text]));
	// A carried keyword counts towards the glossary entry it is explained by ("BLESSED (3)" → BLESSED).
	const byEntry = new Map<string, number>();
	for (const [k, u] of used) {
		const key = keywordKey(k);
		const entry = rows.find((r) => r.name === key || keywordKey(r.name) === key)?.name;
		if (entry) byEntry.set(entry, (byEntry.get(entry) ?? 0) + u.units.length + u.items.length + u.upgrades.length);
	}
	const missing = [...used.entries()]
		.filter(([k]) => !explain(glossary, k)?.trim())
		.map(([name, u]) => ({ name, ...u }))
		.sort((a, b) => a.name.localeCompare(b.name));
	return {
		edition,
		keywords: rows
			.map((k) => ({ ...k, uses: byEntry.get(k.name) ?? 0, carriers: used.get(k.name) ?? null }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		missing
	};
};

export const actions: Actions = {
	save: async ({ request, url, cookies }) => {
		const d = await request.formData();
		const name = String(d.get('name') ?? '').trim().toUpperCase().slice(0, 80);
		const text = String(d.get('text') ?? '').trim().slice(0, 4000);
		if (!name || !text) return fail(400, { message: 'A keyword needs a name and what it means.', at: name });
		const kind = KINDS.find((k) => k === d.get('kind')) ?? null;
		await saveKeyword({ name, kind, text }, await studioEdition({ url, cookies }));
		return { saved: name };
	},
	remove: async ({ request, url, cookies }) => {
		const edition = await studioEdition({ url, cookies });
		const name = String((await request.formData()).get('name') ?? '');
		if ((await usage(edition)).has(name)) return fail(400, { message: `${name} is still carried: take it off first.`, at: name });
		await removeKeyword(name, edition);
		return { removed: name };
	}
};
