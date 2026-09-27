import { error, fail, redirect } from '@sveltejs/kit';
import { FACTIONS } from '$lib/rules/factions';
import { parseTemplate, readTemplate, toTemplate } from '$lib/faction-template';
import { itemFacts, readRules, unitKit } from '$lib/warband-rules';
import { allKeywords, factionRulesText } from '$lib/server/rules-data';
import { applyPack, deleteFaction, packOf, removeRow, resolve, revert, saveFaction, saveItem, saveKeyword, saveRules, saveUnit } from '$lib/server/studio';
import type { Actions, PageServerLoad } from './$types';

const TABS = ['identity', 'rules', 'units', 'armoury', 'keywords', 'yaml'] as const;

export const load: PageServerLoad = async ({ params, url }) => {
	const r = await resolve(params.id);
	const pack = r && (await packOf(params.id));
	if (!r || !pack) error(404, 'No such faction or variant');
	const text = await factionRulesText(r.factionId, r.variant);
	const glossary = await allKeywords();
	return {
		id: params.id,
		tab: TABS.find((t) => t === url.searchParams.get('tab')) ?? (r.custom ? 'identity' : 'units'),
		custom: r.custom,
		pack,
		parentName: r.faction.parent ? FACTIONS.find((f) => f.id === r.faction.parent)?.name : null,
		// What the builder reads now (book text with any overrides), so the Rules form starts from it.
		rules: readRules(text.faction, text.variant, text.overrides),
		kits: Object.fromEntries(pack.units.map((u) => [u.id, unitKit(u.battlekitNote, u.kit)])),
		facts: Object.fromEntries(pack.items.map((i) => [i.id, itemFacts(i)])),
		keywordNames: glossary.map((k) => k.name),
		yaml: toTemplate(pack)
	};
};

const known = () => ({ factions: [...FACTIONS.map((f) => ({ id: f.id, name: f.name })), { id: 'mercenaries', name: 'Mercenaries' }] });

/** The faction part of a template for this page, so rows get the same ids and filing as an imported file. */
async function withFaction(id: string, body: Record<string, unknown>) {
	const r = await resolve(id);
	if (!r) error(404, 'No such faction or variant');
	const faction = r.variant ? { name: r.variant, parent: r.factionId } : { id: r.factionId, name: r.faction.name, alignment: r.faction.alignment };
	return readTemplate({ faction, ...body }, known());
}

const reader = (d: FormData) => {
	const s = (k: string) => String(d.get(k) ?? '').trim();
	const opt = (k: string) => s(k) || undefined;
	/** "Name: 2" per line. */
	const lines = (k: string, key: string) =>
		s(k)
			.split('\n')
			.map((l) => l.trim().match(/^(.*?)(?:\s*:\s*(\d+))?$/))
			.filter((m): m is RegExpMatchArray => !!m && !!m[1])
			.map((m) => ({ name: m[1].trim(), [key]: m[2] ? Number(m[2]) : 1 }));
	return { s, opt, lines };
};

const failed = (errors: { path: string; message: string }[], at: string) => fail(400, { errors, at });

export const actions: Actions = {
	identity: async ({ params, request }) => {
		const r = await resolve(params.id);
		if (!r?.custom) return fail(400, { message: 'Book factions keep their names; edit their rules, units and armoury.' });
		const { s, opt } = reader(await request.formData());
		const hex = (k: string, d: string) => (/^#[0-9a-f]{6}$/i.test(s(k)) ? s(k) : d);
		await saveFaction({
			...r.faction,
			// A variant's name is its identity (its entries are filed under it), so only a new faction can be renamed.
			name: r.faction.parent ? r.faction.name : s('name').slice(0, 80) || r.faction.name,
			alignment: r.faction.parent ? r.faction.alignment : s('alignment') === 'fallen' ? 'fallen' : 'faithful',
			description: opt('description')?.slice(0, 4000) ?? null,
			colours: r.faction.parent ? null : { metal: hex('metal', '#b8b0a0'), low: hex('low', '#8f8570'), high: hex('high', '#ece5d3') }
		});
		return { saved: 'identity' };
	},

	rules: async ({ params, request }) => {
		const d = await request.formData();
		const { s, lines } = reader(d);
		const up = (k: string) => d.getAll(k).map(String);
		const upgrades = up('up_name')
			.map((name, i) => ({ name: name.trim(), keyword: up('up_keyword')[i], max: up('up_max')[i], cost: up('up_cost')[i], currency: up('up_currency')[i], text: up('up_text')[i] }))
			.filter((u) => u.name);
		const { pack, errors } = await withFaction(params.id, {
			rules: {
				start_ducats: s('start_ducats'),
				start_glory: s('start_glory'),
				excluded: s('excluded'),
				must_include: lines('must_include', 'n'),
				leader: s('leader'),
				optional: s('optional'),
				caps: lines('caps', 'max'),
				free_items: s('free_items'),
				fireteams: s('fireteams'),
				upgrades,
				text: s('text')
			}
		});
		if (!pack) return failed(errors, 'rules');
		await saveRules(pack.rules);
		return { saved: 'rules' };
	},

	unit: async ({ params, request }) => {
		const d = await request.formData();
		const { s, opt } = reader(d);
		const { pack, errors } = await withFaction(params.id, {
			units: [
				{
					name: s('name'),
					category: s('category'),
					cost: s('cost'),
					currency: s('currency'),
					availability: { min: s('min'), max: opt('max') },
					stats: Object.fromEntries(['movement', 'ranged', 'melee', 'armour', 'base'].map((k) => [k, s(k)])),
					keywords: s('keywords'),
					abilities: s('abilities')
						.split(/\n\s*\n/)
						.map((b) => b.trim())
						.filter(Boolean)
						.map((b) => {
							const [name, ...rest] = b.split(':');
							return { name: name.trim(), text: rest.join(':').trim() };
						}),
					battlekit_note: s('battlekit_note'),
					powers: s('powers'),
					description: s('description'),
					kit: d.has('kit_on')
						? {
								fixed: s('kit_fixed'),
								except: d.getAll('kit_except').map(String),
								nothing_else: d.has('kit_nothing_else'),
								swap: s('swap_from') && s('swap_to') ? { from: s('swap_from'), to: s('swap_to'), extra: s('swap_extra') } : undefined
							}
						: undefined,
					hired_by: s('hire_alignment') || s('hire_by') ? { alignment: opt('hire_alignment'), by: s('hire_by') } : undefined
				}
			]
		});
		if (!pack) return failed(errors, s('id') || 'new-unit');
		const row = { ...pack.units[0], id: s('id') || pack.units[0].id };
		await saveUnit(row);
		return { saved: row.id };
	},

	item: async ({ params, request }) => {
		const d = await request.formData();
		const { s, opt } = reader(d);
		const { pack, errors } = await withFaction(params.id, {
			armoury: [
				{
					name: s('name'),
					category: s('category'),
					type: opt('type'),
					range: s('range'),
					cost: s('cost'),
					currency: s('currency'),
					limit: s('limit'),
					unique: d.has('unique'),
					keywords: s('keywords'),
					text: s('text'),
					description: s('description'),
					stipulations: {
						only: s('only'),
						per_model: s('per_model'),
						...Object.fromEntries(['shield_combo', 'bayonet_lug', 'consumable', 'headgear', 'exploration_only'].map((k) => [k, d.has(k)]))
					}
				}
			]
		});
		if (!pack) return failed(errors, s('id') || 'new-item');
		const row = { ...pack.items[0], id: s('id') || pack.items[0].id };
		// Ticks that say what the book's own wording already says keep the wording (and the entry stays the book's).
		const old = (await packOf(params.id))?.items.find((i) => i.id === row.id);
		if (old && !old.stipulations) {
			const same = (a: object, b: object) => (Object.keys(row.stipulations ?? {}) as (keyof typeof a)[]).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
			if (same(itemFacts({ ...row, restrictions: old.restrictions, stipulations: null }), itemFacts(row))) Object.assign(row, { stipulations: null, restrictions: old.restrictions });
		}
		await saveItem(row);
		return { saved: row.id };
	},

	keyword: async ({ request }) => {
		const { s } = reader(await request.formData());
		const name = s('name').toUpperCase().slice(0, 80);
		if (!name || !s('text')) return fail(400, { message: 'A keyword needs a name and its text.' });
		await saveKeyword({ name, kind: ['Tag', 'Effect', 'Tag, Effect'].find((k) => k === s('kind')) ?? null, text: s('text').slice(0, 4000) });
		return { saved: name };
	},

	revert: async ({ request }) => {
		const { s } = reader(await request.formData());
		await revert(s('kind') === 'item' ? 'item' : 'unit', s('id'));
		return { saved: s('id') };
	},

	remove: async ({ request }) => {
		const { s } = reader(await request.formData());
		await removeRow(s('kind') === 'item' ? 'item' : 'unit', s('id'));
		return { saved: 'removed' };
	},

	yaml: async ({ params, request }) => {
		const { s } = reader(await request.formData());
		const { pack, errors } = parseTemplate(s('yaml'), known());
		if (!pack) return failed(errors, 'yaml');
		if (pack.faction.id !== params.id) return failed([{ path: 'faction', message: `this file is for “${pack.faction.name}”; import it from the Studio's front page` }], 'yaml');
		await applyPack(pack);
		return { saved: 'yaml' };
	},

	delete: async ({ params }) => {
		if (!(await deleteFaction(params.id))) return fail(400, { message: 'Only your own factions and variants can be deleted.' });
		redirect(303, '/admin/studio');
	}
};
