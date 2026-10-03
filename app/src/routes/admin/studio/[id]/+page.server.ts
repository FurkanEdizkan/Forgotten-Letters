import { copyEntries, editions, studioEdition } from '$lib/server/editions';
import { readLimits, type Limit } from '$lib/warband-limits';
import type { Cookies } from '@sveltejs/kit';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { rulesItem, rulesUnit } from '$lib/server/db/schema';
import { FACTIONS } from '$lib/rules/factions';
import { itemId, parseTemplate, readTemplate, toTemplate, unitId } from '$lib/faction-template';
import { itemFacts, readRules, unitKit, type StipulationsOverride } from '$lib/warband-rules';
import { stable } from '$lib/rules-versions';
import { keywordKey } from '$lib/keywords';
import { allItemNames, allKeywords, allPatrons, factionRulesText } from '$lib/server/rules-data';
import { applyPack, deleteFaction, packOf, removeRow, resolve, revert, saveFaction, saveItem, saveKeyword, saveRules, saveUnit, setOrder } from '$lib/server/studio';
import type { Actions, PageServerLoad } from './$types';

const TABS = ['board', 'identity', 'rules', 'units', 'armoury', 'keywords', 'yaml'] as const;

/** The edition being edited: ?edition=, else the current one. */
const ed = (url: URL, cookies: Cookies) => studioEdition({ url, cookies });

export const load: PageServerLoad = async ({ params, url, cookies }) => {
	const r = await resolve(params.id);
	const pack = r && (await packOf(params.id, await ed(url, cookies)));
	if (!r || !pack) error(404, 'No such faction or variant');
	const edition = await ed(url, cookies);
	const text = await factionRulesText(r.factionId, r.variant, edition);
	const glossary = await allKeywords(edition);
	const tab = TABS.find((t) => t === url.searchParams.get('tab')) ?? 'board';
	// The rules already written in this faction, to copy from the library.
	const rules = readRules(text.faction, text.variant, text.overrides);
	const written: { from: string; label?: string; limit: Limit }[] = [
		...(pack.rules.overrides?.limits ?? []).map((limit) => ({ from: 'Warband rules', limit })),
		...(pack.rules.overrides?.upgrades ?? []).flatMap((u) => (u.limits ?? []).map((limit) => ({ from: u.name, limit }))),
		...pack.units.flatMap((u) => (u.kit?.limits ?? []).map((limit) => ({ from: u.name, limit }))),
		...pack.items.flatMap((i) => (i.stipulations?.limits ?? []).map((limit) => ({ from: i.name, limit })))
	];
	return {
		id: params.id,
		tab,
		edition,
		editions: (await editions()).map((e) => ({ id: e.id, status: e.status })),
		entry: url.searchParams.get('entry'),
		card: url.searchParams.get('card'),
		glossary: Object.fromEntries(glossary.map((k) => [keywordKey(k.name), k.text])),
		library: {
			keywords: glossary.map((k) => ({ name: k.name, note: k.kind ?? '', title: k.text, missing: !k.text?.trim() })),
			items: pack.items.map((i) => ({ name: i.name, note: `${i.cost} ${i.currency === 'glory' ? 'G' : 'D'}` })),
			units: pack.units.map((u) => ({ name: u.name, note: u.category })),
			limits: [...PRESETS.map((p) => ({ from: 'Ready rule', ...p })), ...written]
		},
		itemNames: await allItemNames(edition),
		// The edition's other cards, to add to this warband from the board's library.
		others: await otherCards(edition, r.factionId, r.variant),
		// A variant's warbands also take its faction's units and kit (unless it replaces or excludes them).
		inherited: await (async () => {
			if (!r.variant) return { units: [], items: [] };
			const base = await packOf(r.factionId, edition);
			const own = (xs: { name: string }[]) => new Set(xs.map((x) => x.name.toLowerCase()));
			const ou = own(pack.units), oi = own(pack.items);
			return { units: (base?.units ?? []).filter((u) => !ou.has(u.name.toLowerCase())), items: (base?.items ?? []).filter((i) => !oi.has(i.name.toLowerCase())) };
		})(),
		patronNames: (await allPatrons(edition)).map((x) => x.name),
		factionIds: FACTIONS.map((f) => f.id),
		custom: r.custom,
		pack,
		parentName: r.faction.parent ? FACTIONS.find((f) => f.id === r.faction.parent)?.name : null,
		// What the builder reads now (book text with any overrides), so the Rules form starts from it.
		rules,
		kits: Object.fromEntries([...pack.units, ...(r.variant ? ((await packOf(r.factionId, edition))?.units ?? []) : [])].map((u) => [u.id, unitKit(u.battlekitNote, u.kit)])),
		facts: Object.fromEntries(pack.items.map((i) => [i.id, itemFacts(i)])),
		keywordNames: glossary.map((k) => k.name),
		yaml: toTemplate(pack)
	};
};

/** Units and kit elsewhere in the edition (other factions, mercenaries, Glory Items, finds) a warband may take in. */
async function otherCards(edition: string, faction: string, variant: string | null) {
	const mine = (f: string, v: string | null) => f === faction && (v ?? null) === variant;
	const [units, items] = await Promise.all([
		db.select({ id: rulesUnit.id, name: rulesUnit.name, faction: rulesUnit.faction, variant: rulesUnit.variant, cost: rulesUnit.cost, currency: rulesUnit.currency }).from(rulesUnit).where(eq(rulesUnit.edition, edition)),
		db.select({ id: rulesItem.id, name: rulesItem.name, faction: rulesItem.faction, variant: rulesItem.variant, cost: rulesItem.cost, currency: rulesItem.currency, category: rulesItem.category }).from(rulesItem).where(eq(rulesItem.edition, edition))
	]);
	const from = (f: string, v: string | null) => (v ? `${v}` : (FACTIONS.find((x) => x.id === f)?.name ?? f.replace(/-/g, ' ')));
	return {
		units: units.filter((u) => !mine(u.faction, u.variant)).map((u) => ({ name: u.name, note: from(u.faction, u.variant), value: { name: u.name, adopt: 'unit', id: u.id } })),
		items: items.filter((i) => !mine(i.faction, i.variant)).map((i) => ({ name: i.name, note: `${from(i.faction, i.variant)} · ${i.cost}${i.currency === 'glory' ? 'G' : 'D'}`, value: { name: i.name, adopt: 'item', id: i.id } }))
	};
}

/** Ready rules for the library: the shapes the books use most. */
const PRESETS: { label: string; limit: Limit }[] = [
	{ label: 'At most 1 HEAVY item a model', limit: { items: { keywords: ['HEAVY'] }, max: 1 } },
	{ label: 'Must carry Armour', limit: { items: { categories: ['armour'] }, min: 1 } },
	{ label: 'Cannot take these items (name them)', limit: { items: { names: [] }, max: 0 } },
	{ label: 'May take only these items (name them)', limit: { items: { not: { names: [] } }, max: 0 } },
	{ label: 'At most 2 weapons (a 2-Handed one is two)', limit: { count: 'weapons', items: { categories: ['ranged', 'melee'] }, max: 2 } },
	{ label: 'At most 1 of these upgrades (name them)', limit: { upgrades: [], max: 1 } },
	{ label: 'One of these for every 2 of those (name them)', limit: { models: { entries: [] }, max: 1, per: { models: { entries: [] }, each: 2 } } },
	{ label: 'Must include one of these entries (name them)', limit: { entries: [], min: 1 } },
	{ label: 'No model worth under 80 Ducats', limit: { models: { value_under: 80 }, max: 0 } }
];

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
	const all = (k: string) => d.getAll(k).map((x) => String(x).trim()).filter(Boolean);
	/** Which of the editor's fields the form sent (a field sent empty clears its value; one not sent keeps it). */
	const sent = new Set(d.getAll('_sent').map(String));
	/** A field the editor posts as JSON, as written (an empty `{}` inside a rule means "any"); empty is none. */
	const json = (k: string): unknown => {
		try {
			const v = JSON.parse(s(k));
			return v == null || (typeof v === 'object' && !Object.keys(v).length) ? undefined : v;
		} catch {
			return undefined;
		}
	};
	return { s, opt, lines, all, sent, json };
};

/** Only the fields given: no undefined, empty text or empty list (values inside are kept as written). */
const given = (o: Record<string, unknown>) =>
	Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && !(v && typeof v === 'object' && !Object.keys(v).length)));

/**
 * What to save of an edited override: a value changed from what is in effect now is saved; an unchanged one keeps
 * what the saved override had (so a variant doesn't copy its faction's rules, nor a book row gain the defaults).
 */
function pinned<T extends object>(next: T | null | undefined, had: object | null | undefined, now: object): T | null {
	if (!next) return null;
	const was = (had ?? {}) as Record<string, unknown>;
	const out = Object.entries(next).flatMap(([k, v]) =>
		stable(v ?? null) !== stable((now as Record<string, unknown>)[k] ?? null) ? [[k, v]] : k in was ? [[k, was[k]]] : []
	);
	return out.length ? (Object.fromEntries(out) as T) : null;
}

const STIPULATION_FIELDS: Record<string, (keyof StipulationsOverride)[]> = {
	alignment: ['alignment'],
	factions: ['factions'],
	stip_limits: ['limits'],
	stip_limit_excludes: ['limitExcludes'],
	drop_keywords: ['dropKeywords']
};

/** The saved row's keys whose form field was not sent: kept as they were. */
const unsent = <T extends object>(was: T | null | undefined, sent: Set<string>, fields: Record<string, (keyof T)[]>): Partial<T> =>
	was ? keep(was, Object.entries(fields).flatMap(([f, ks]) => (sent.has(f) ? [] : ks))) : {};

/** The keys of a saved row that a form doesn't edit, to carry over. */
const keep = <T extends object>(o: T, ks: (keyof T)[]): Partial<T> => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) as Partial<T>;

const failed = (errors: { path: string; message: string }[], at: string) => fail(400, { errors, at });

export const actions: Actions = {
	identity: async ({ params, request, url, cookies }) => {
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

	rules: async ({ params, request, url, cookies }) => {
		const d = await request.formData();
		const { s, all, sent, json } = reader(d);
		const zip = (names: string, nums: string, key: string) =>
			d
				.getAll(names)
				.map((n, k) => ({ name: String(n).trim(), [key]: Number(d.getAll(nums)[k] ?? 1) }))
				.filter((x) => x.name);
		const { pack, errors } = await withFaction(params.id, {
			rules: {
				start_ducats: s('start_ducats'),
				start_glory: s('start_glory'),
				excluded: all('excluded'),
				must_include: zip('mi_name', 'mi_n', 'n'),
				leader: s('leader'),
				optional: all('optional'),
				caps: zip('cap_name', 'cap_max', 'max'),
				free_items: all('free_items'),
				fireteams: s('fireteams'),
				upgrades: json('upgrades_json') ?? [],
				...given({
					limits: sent.has('rules_limits') ? json('rules_limits') : undefined,
					prices: sent.has('rules_prices') ? json('rules_prices') : undefined,
					patron: sent.has('patron') ? s('patron') : undefined,
					requires_variant: sent.has('patron') && d.has('requires_variant') ? true : undefined
				}),
				text: s('text')
			}
		});
		if (!pack) return failed(errors, 'rules');
		// What the form didn't send stays as it was (a pack's keys this form doesn't edit).
		const edition = await ed(url, cookies);
		const old = (await packOf(params.id, edition))?.rules.overrides ?? {};
		const r = (await resolve(params.id))!;
		const text = await factionRulesText(r.factionId, r.variant, edition);
		// Only what differs from the rules as they read now is pinned (a variant doesn't copy its faction's rules).
		const o = pinned(pack.rules.overrides, old, readRules(text.faction, text.variant, text.overrides)) ?? {};
		Object.assign(o, unsent(old, sent, { rules_limits: ['limits'], rules_prices: ['prices'], patron: ['patron', 'requiresVariant'], alignment: ['alignment'] }));
		pack.rules.overrides = o;
		await saveRules(pack.rules, edition);
		return { saved: 'rules' };
	},

	unit: async ({ params, request, url, cookies }) => {
		const d = await request.formData();
		const { s, opt, all, sent, json } = reader(d);
		const ifSent = <T,>(f: string, v: T) => (sent.has(f) ? v : undefined);
		// Kit as an entry carries it is taken as written: `shield_combo: false` means something.
		let carried: Record<string, unknown> | undefined;
		try {
			carried = JSON.parse(s('kit_items'));
		} catch {
			carried = undefined;
		}
		const structured = {
			...given({
				limits: ifSent('kit_limits', json('kit_limits')),
				hands: ifSent('hands', given({ ranged: opt('hands_ranged'), melee: opt('hands_melee') })),
				heavy_one_hand: ifSent('hands', opt('heavy_one_hand')),
				loadouts: ifSent('kit_loadouts', json('kit_loadouts')),
				prices: ifSent('kit_prices', json('kit_prices')),
				counts_as: ifSent('counts_as', opt('counts_as'))
			}),
			...(sent.has('kit_items') && carried && Object.keys(carried).length ? { items: carried } : {}),
			...(sent.has('recruit') && d.has('no_recruit') ? { recruit: false } : {})
		};
		const byHand = d.has('kit_on')
			? {
					fixed: all('kit_fixed'),
					except: d.getAll('kit_except').map(String),
					nothing_else: d.has('kit_nothing_else'),
					swap: s('swap_from') && s('swap_to') ? { from: s('swap_from'), to: s('swap_to'), extra: s('swap_extra') } : undefined
				}
			: {};
		const kitIn = { ...byHand, ...structured };
		const abilities = sent.has('abilities')
			? d
					.getAll('ab_name')
					.map((n, k) => ({ name: String(n).trim(), text: String(d.getAll('ab_text')[k] ?? '').trim() }))
					.filter((a) => a.name)
			: s('abilities')
					.split(/\n\s*\n/)
					.map((b) => b.trim())
					.filter(Boolean)
					.map((b) => {
						const [name, ...rest] = b.split(':');
						return { name: name.trim(), text: rest.join(':').trim() };
					});
		const { pack, errors } = await withFaction(params.id, {
			units: [
				{
					name: s('name'),
					category: s('category'),
					cost: s('cost'),
					currency: s('currency'),
					availability: { min: s('min'), max: opt('max') },
					stats: Object.fromEntries(['movement', 'ranged', 'melee', 'armour', 'base'].map((k) => [k, s(k)])),
					keywords: all('keywords'),
					abilities,
					battlekit_note: s('battlekit_note'),
					powers: s('powers'),
					description: s('description'),
					kit: Object.keys(kitIn).length ? kitIn : undefined,
					hired_by: s('hire_alignment') || s('hire_by') ? { alignment: opt('hire_alignment'), by: s('hire_by') } : undefined
				}
			]
		});
		if (!pack) return failed(errors, s('id') || 'new-unit');
		const row = { ...pack.units[0], id: s('id') || pack.units[0].id };
		const was = (await packOf(params.id, await ed(url, cookies)))?.units.find((u) => u.id === row.id)?.kit;
		const kept = unsent(was, sent, {
			kit_limits: ['limits'],
			hands: ['hands', 'heavyOneHand'],
			kit_loadouts: ['loadouts'],
			kit_prices: ['prices'],
			kit_items: ['items'],
			counts_as: ['countsAs'],
			recruit: ['recruit']
		});
		if (Object.keys(kept).length) row.kit = { ...kept, ...(row.kit ?? {}) };
		const wasRow = (await packOf(params.id, await ed(url, cookies)))?.units.find((u) => u.id === row.id);
		if (wasRow) row.kit = pinned(row.kit, wasRow.kit, unitKit(wasRow.battlekitNote, wasRow.kit));
		await saveUnit(row, await ed(url, cookies));
		return { saved: row.id };
	},

	item: async ({ params, request, url, cookies }) => {
		const d = await request.formData();
		const { s, opt, all, sent, json } = reader(d);
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
					keywords: all('keywords'),
					text: s('text'),
					description: s('description'),
					stipulations: {
						only: all('only'),
						per_model: s('per_model'),
						...Object.fromEntries(['shield_combo', 'bayonet_lug', 'consumable', 'headgear', 'exploration_only'].map((k) => [k, d.has(k)])),
						...given({
							alignment: opt('alignment'),
							factions: all('factions'),
							limits: json('stip_limits'),
							limit_excludes: json('stip_limit_excludes'),
							drop_keywords: all('drop_keywords')
						})
					}
				}
			]
		});
		if (!pack) return failed(errors, s('id') || 'new-item');
		const row = { ...pack.items[0], id: s('id') || pack.items[0].id };
		const old = (await packOf(params.id, await ed(url, cookies)))?.items.find((i) => i.id === row.id);
		if (old) {
			// Only what differs from the item as it reads now is pinned; ticks its wording already gives stay its wording.
			const st = pinned(row.stipulations, old.stipulations, itemFacts(old));
			const merged = { ...(st ?? {}), ...unsent(old.stipulations, sent, STIPULATION_FIELDS) };
			row.stipulations = Object.keys(merged).length ? merged : null;
			if (!old.stipulations && !row.stipulations) row.restrictions = old.restrictions;
		}
		await saveItem(row, await ed(url, cookies));
		return { saved: row.id };
	},

	keyword: async ({ request, url, cookies }) => {
		const { s } = reader(await request.formData());
		const name = s('name').toUpperCase().slice(0, 80);
		if (!name || !s('text')) return fail(400, { message: 'A keyword needs a name and its text.' });
		await saveKeyword({ name, kind: ['Tag', 'Effect', 'Tag, Effect'].find((k) => k === s('kind')) ?? null, text: s('text').slice(0, 4000) }, await ed(url, cookies));
		return { saved: name };
	},

	/** One change made on a unit's card (its name, cost, stats, keywords, abilities or kit): only that is saved. */
	patchUnit: async ({ params, request, url, cookies }) => {
		const { s } = reader(await request.formData());
		const edition = await ed(url, cookies);
		const row = (await packOf(params.id, edition))?.units.find((u) => u.id === s('id'));
		if (!row) return fail(400, { message: 'No such unit here.' });
		let p: Record<string, unknown>;
		try {
			p = JSON.parse(s('patch'));
		} catch {
			return fail(400, { message: 'That change could not be read.' });
		}
		const int = (v: unknown) => Math.max(0, Math.round(Number(v)) || 0);
		const names = (v: unknown, upper = false) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean).map((x) => (upper ? x.toUpperCase() : x)))] : null);
		const next = { ...row };
		if (typeof p.name === 'string' && p.name.trim()) next.name = p.name.trim().slice(0, 80);
		if ('cost' in p) next.cost = int(p.cost);
		if (p.currency === 'ducats' || p.currency === 'glory') next.currency = p.currency;
		if (p.category === 'elite' || p.category === 'troop' || p.category === 'mercenary') next.category = p.category;
		if ('min' in p) next.availabilityMin = int(p.min);
		if ('max' in p) next.availabilityMax = p.max === '' || p.max == null ? null : int(p.max);
		if (p.stats && typeof p.stats === 'object')
			next.stats = { ...row.stats, ...Object.fromEntries(Object.entries(p.stats as Record<string, unknown>).filter(([k]) => ['movement', 'ranged', 'melee', 'armour', 'base'].includes(k)).map(([k, v]) => [k, String(v).trim().slice(0, 40)])) };
		const kw = names(p.keywords, true);
		if (kw) next.keywords = kw;
		if (Array.isArray(p.abilities))
			next.abilities = (p.abilities as { name?: unknown; text?: unknown }[]).map((a) => ({ name: String(a.name ?? '').trim(), text: String(a.text ?? '').trim() })).filter((a) => a.name);
		const fixed = names(p.fixed);
		if (fixed) next.kit = { ...(row.kit ?? {}), fixed };
		await saveUnit(next, edition);
		return { saved: row.id };
	},

	/** One change made on an item's card. */
	patchItem: async ({ params, request, url, cookies }) => {
		const { s } = reader(await request.formData());
		const edition = await ed(url, cookies);
		const row = (await packOf(params.id, edition))?.items.find((i) => i.id === s('id'));
		if (!row) return fail(400, { message: 'No such item here.' });
		let p: Record<string, unknown>;
		try {
			p = JSON.parse(s('patch'));
		} catch {
			return fail(400, { message: 'That change could not be read.' });
		}
		const int = (v: unknown) => Math.max(0, Math.round(Number(v)) || 0);
		const next = { ...row };
		if (typeof p.name === 'string' && p.name.trim()) next.name = p.name.trim().slice(0, 80);
		if ('cost' in p) next.cost = int(p.cost);
		if (p.currency === 'ducats' || p.currency === 'glory') next.currency = p.currency;
		if ('limit' in p) next.limit = p.limit === '' || p.limit == null ? null : int(p.limit);
		if (typeof p.range === 'string') next.range = p.range.trim().slice(0, 40) || null;
		if (typeof p.text === 'string') next.text = p.text.trim().slice(0, 4000) || null;
		if (Array.isArray(p.keywords)) next.keywords = [...new Set(p.keywords.map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
		await saveItem(next, edition);
		return { saved: row.id };
	},

	/** Take a unit or item from elsewhere in the edition into this warband: a copy of it, filed here. */
	adopt: async ({ params, request, url, cookies }) => {
		const { s } = reader(await request.formData());
		const edition = await ed(url, cookies);
		const r = await resolve(params.id);
		if (!r) error(404, 'No such faction or variant');
		const kind = s('kind') === 'item' ? 'item' : 'unit';
		const t = (kind === 'unit' ? rulesUnit : rulesItem) as typeof rulesUnit;
		const [src] = await db.select().from(t).where(and(eq(t.edition, edition), eq(t.id, s('id'))));
		if (!src) return fail(400, { message: 'That card is not in this edition.' });
		const id = (kind === 'unit' ? unitId : itemId)(r.factionId, r.variant, src.name);
		const pack = await packOf(params.id, edition);
		if ((kind === 'unit' ? pack?.units : pack?.items)?.some((x) => x.id === id)) return fail(400, { message: `${src.name} already has a card of its own here.` });
		const { edition: _e, origin: _o, verified: _v, bookCopy: _b, sort: _s, ...row } = src;
		const copy = { ...row, id, faction: r.factionId, variant: r.variant };
		if (kind === 'unit') await saveUnit(copy as Parameters<typeof saveUnit>[0], edition);
		else await saveItem(copy as unknown as Parameters<typeof saveItem>[0], edition);
		return { adopted: src.name, card: `${kind}:${id}` };
	},

	/** Take an entry, item or upgrade away from this warband (or give it back): the rules' "cannot include". */
	exclude: async ({ params, request, url, cookies }) => {
		const { s } = reader(await request.formData());
		const edition = await ed(url, cookies);
		const pack = await packOf(params.id, edition);
		if (!pack) error(404, 'No such faction or variant');
		const name = s('name');
		const o = { ...(pack.rules.overrides ?? {}) };
		const was = o.excluded ?? [];
		o.excluded = s('on') === '1' ? [...was.filter((x) => x !== name), name] : was.filter((x) => x !== name);
		await saveRules({ ...pack.rules, overrides: o }, edition);
		return { saved: 'rules' };
	},

	/** A rule dropped on the board's Rules lane: one more of the warband's building limits. */
	addLimit: async ({ params, request, url, cookies }) => {
		const { json } = reader(await request.formData());
		const errs: { path: string; message: string }[] = [];
		const [limit] = readLimits([json('limit')], 'limit', (path, message) => errs.push({ path, message })) ?? [];
		if (!limit || errs.length) return fail(400, { message: `That rule is not complete: ${errs.map((e) => e.message).join('; ')}` });
		const edition = await ed(url, cookies);
		const pack = await packOf(params.id, edition);
		if (!pack) error(404, 'No such faction or variant');
		const o = { ...(pack.rules.overrides ?? {}) };
		o.limits = [...(o.limits ?? []), limit];
		await saveRules({ ...pack.rules, overrides: o }, edition);
		return { saved: 'rules' };
	},

	/** A new order of the units or the armoury (dragged in the list): saved as their `sort`. */
	order: async ({ request, url, cookies }) => {
		const { s, all } = reader(await request.formData());
		await setOrder(s('kind') === 'item' ? 'item' : 'unit', all('id'), await ed(url, cookies));
		return { ordered: true };
	},

	/** Copy the chosen entries into another edition (replacing its copies). */
	copyTo: async ({ request, url, cookies }) => {
		const { s, all } = reader(await request.formData());
		const from = await ed(url, cookies);
		const to = s('to');
		if (!to || to === from || !(await editions()).some((e) => e.id === to)) return fail(400, { message: 'Choose another edition to copy to.' });
		const n = await copyEntries(s('kind') === 'item' ? 'items' : 'units', all('id'), from, to);
		return { copied: n, to };
	},

	revert: async ({ request, url, cookies }) => {
		const { s } = reader(await request.formData());
		await revert(s('kind') === 'item' ? 'item' : 'unit', s('id'), await ed(url, cookies));
		return { saved: s('id') };
	},

	remove: async ({ request, url, cookies }) => {
		const { s } = reader(await request.formData());
		await removeRow(s('kind') === 'item' ? 'item' : 'unit', s('id'), await ed(url, cookies));
		return { saved: 'removed' };
	},

	yaml: async ({ params, request, url, cookies }) => {
		const { s } = reader(await request.formData());
		const { pack, errors } = parseTemplate(s('yaml'), known());
		if (!pack) return failed(errors, 'yaml');
		if (pack.faction.id !== params.id) return failed([{ path: 'faction', message: `this file is for “${pack.faction.name}”; import it from the Studio's front page` }], 'yaml');
		await applyPack(pack, await ed(url, cookies));
		return { saved: 'yaml' };
	},

	delete: async ({ params }) => {
		if (!(await deleteFaction(params.id))) return fail(400, { message: 'Only your own factions and variants can be deleted.' });
		redirect(303, '/admin/studio');
	}
};
