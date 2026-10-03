<script lang="ts">
	/**
	 * One unit in the Rules Editor: its profile, keywords, abilities and kit, and the rules the builder holds its
	 * models to, with a preview of how it reads in the builder. Kept by its parent per unit (`{#key}`).
	 */
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import { explain } from '$lib/keywords';
	import { KIT_EXCEPT, UNIT_CATEGORIES } from '$lib/faction-template';
	import { describeLimit, type Limit, type Loadout } from '$lib/warband-limits';
	import type { UnitKit, UnitKitOverride } from '$lib/warband-rules';
	import ChipList from './ChipList.svelte';
	import KeywordChips from './KeywordChips.svelte';
	import LimitEditor from './LimitEditor.svelte';
	import LoadoutEditor from './LoadoutEditor.svelte';
	import RulesText from './RulesText.svelte';
	import SortableList from './SortableList.svelte';

	type Unit = {
		id: string;
		name: string;
		category: string;
		cost: number;
		currency: string;
		availabilityMin: number;
		availabilityMax: number | null;
		stats: Record<string, string | number | undefined>;
		keywords: string[];
		abilities: { name: string; text: string }[];
		battlekitNote: string | null;
		powers: string | null;
		description: string | null;
		kit: UnitKitOverride | null;
	};
	let { u, kit, glossary, errors, saved }: { u: Unit; kit: UnitKit; glossary: Record<string, string>; errors: Snippet; saved: boolean } = $props();

	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const STATS = ['movement', 'ranged', 'melee', 'armour', 'base'] as const;
	const k = () => Math.random();

	// Seeded once: the parent keys this form by unit.
	const [U, K] = (() => [u, kit] as const)();
	const o = U.kit ?? {};
	let name = $state(U.name);
	let cost = $state(U.cost);
	let currency = $state(U.currency);
	let stats = $state({ ...U.stats });
	let keywords = $state([...U.keywords]);
	let abilities = $state(U.abilities.map((a) => ({ ...a, key: k() })));
	let fixed = $state([...K.fixed]);
	let limits = $state<Limit[]>(o.limits ?? []);
	let byHand = $state(o.fixed !== undefined || o.except !== undefined || o.nothingElse !== undefined || !!o.swap);
	let prices = $state(Object.entries(o.prices ?? {}).map(([item, p]) => ({ key: k(), item, cost: p.cost, currency: p.currency })));
	let carried = $state(Object.entries(o.items ?? {}).map(([item, s]) => ({ key: k(), item, combo: s.shieldCombo == null ? '' : s.shieldCombo ? 'yes' : 'no', drop: s.dropKeywords ?? [] })));

	const pricesOut = $derived(Object.fromEntries(prices.filter((p) => p.item.trim()).map((p) => [p.item.trim(), p.currency === 'glory' ? { cost: p.cost, currency: 'glory' } : p.cost])));
	const carriedOut = $derived(
		Object.fromEntries(
			carried
				.filter((c) => c.item.trim())
				.map((c) => [c.item.trim(), { ...(c.combo ? { shield_combo: c.combo === 'yes' } : {}), ...(c.drop.length ? { drop_keywords: c.drop } : {}) }])
		)
	);
	const titleOf = (v: string) => explain(glossary, v) ?? 'No explanation yet: add one in Keywords.';
</script>

<form method="POST" action="?/unit" use:enhance={keep} class="unit">
	<input type="hidden" name="id" value={u.id} />

	<section class="preview" aria-label="How it reads in the builder">
		<div class="card-head">
			<b>{name || 'New unit'}</b>
			<span>{cost} {currency === 'glory' ? 'Glory' : 'Ducats'}</span>
		</div>
		<p class="stats">{#each STATS as s (s)}<span><small>{s.slice(0, 3)}</small> {stats[s] || '–'}</span>{/each}</p>
		<KeywordChips {keywords} {glossary} />
		{#each abilities.filter((a) => a.name) as a (a.key)}<p class="ab"><b>{a.name}:</b> <RulesText text={a.text} {glossary} /></p>{/each}
		{#if fixed.length}<p class="ab"><b>Always has:</b> {fixed.join(', ')}</p>{/if}
		{#each limits as l, i (i)}<p class="rule">{l.text ?? describeLimit(l)}</p>{/each}
	</section>

	<fieldset class="grid">
		<legend>Profile</legend>
		<label class="wide">Name <input name="name" bind:value={name} required /></label>
		<label>Kind <select name="category" value={u.category}>{#each UNIT_CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}</select></label>
		<label>Cost <input name="cost" type="number" min="0" bind:value={cost} /></label>
		<label>In <select name="currency" bind:value={currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
		<label>At least <input name="min" type="number" min="0" value={u.availabilityMin} /></label>
		<label>At most <input name="max" type="number" min="0" value={u.availabilityMax ?? ''} placeholder="any" /></label>
		{#each STATS as s (s)}<label>{s} <input name={s} bind:value={stats[s]} /></label>{/each}
	</fieldset>

	<fieldset>
		<legend>Keywords</legend>
		<ChipList name="keywords" kinds={['keyword']} list="dl-keyword" upper label="{name || 'Unit'} keywords" placeholder="Add a keyword, or drag one from the library…" bind:values={keywords} {titleOf} />
	</fieldset>

	<fieldset>
		<legend>Abilities</legend>
		<SortableList bind:items={abilities} label="Abilities" removable keyOf={(a) => a.key}>
			{#snippet row(a)}
				<div class="ability">
					<input name="ab_name" bind:value={a.name} placeholder="Name" aria-label="Ability name" />
					<textarea name="ab_text" bind:value={a.text} rows="2" placeholder="What it does" aria-label="Ability text"></textarea>
				</div>
			{/snippet}
		</SortableList>
		<button type="button" class="ghost" onclick={() => abilities.push({ name: '', text: '', key: k() })}>+ Add an ability</button>
		<input type="hidden" name="_sent" value="abilities" />
	</fieldset>

	<fieldset>
		<legend>Battlekit</legend>
		<label>As printed <small>(the builder reads it unless set by hand below)</small><input name="battlekit_note" value={u.battlekitNote ?? ''} /></label>
		<label class="tick"><input type="checkbox" name="kit_on" bind:checked={byHand} /> Set what it always has and may not take by hand</label>
		{#if byHand}
			<div class="sub">
				<span class="lbl">Always has</span>
				<ChipList name="kit_fixed" kinds={['item']} list="dl-item" label="Always has" placeholder="Armoury items…" bind:values={fixed} />
				<div class="ticks">No other: {#each KIT_EXCEPT as c (c)}<label class="tick"><input type="checkbox" name="kit_except" value={c} checked={kit.except.includes(c)} /> {c}</label>{/each}</div>
				<label class="tick"><input type="checkbox" name="kit_nothing_else" checked={kit.nothingElse} /> Cannot have any other battlekit</label>
				<div class="row3">
					<label>Upgrade: swap <input name="swap_from" value={kit.swap?.from ?? ''} list="dl-item" /></label>
					<label>for <input name="swap_to" value={kit.swap?.to ?? ''} list="dl-item" /></label>
					<label>costing more <input name="swap_extra" type="number" min="0" value={kit.swap?.extra ?? ''} /></label>
				</div>
			</div>
		{/if}
		<div class="row3">
			<label>Ranged weapons held <input name="hands_ranged" type="number" min="0" value={o.hands?.ranged ?? ''} placeholder="2" /></label>
			<label>Melee weapons held <input name="hands_melee" type="number" min="0" value={o.hands?.melee ?? ''} placeholder="2" /></label>
			<label>HEAVY 2-Handed in one hand <input name="heavy_one_hand" type="number" min="0" value={o.heavyOneHand ?? ''} placeholder="0" /></label>
		</div>
		<input type="hidden" name="_sent" value="hands" />
	</fieldset>

	<fieldset>
		<legend>Its rules <small>(for this entry’s models)</small></legend>
		<LimitEditor name="kit_limits" label="{name || 'Unit'} rules" scope="this entry’s models" bind:value={limits} />
	</fieldset>

	<details class="more" open={!!(o.loadouts?.length || prices.length || carried.length || o.countsAs || o.recruit === false)}>
		<summary>Loadouts, own prices, kit as it carries it, counts as…</summary>
		<fieldset>
			<legend>Must carry one of these sets</legend>
			<LoadoutEditor name="kit_loadouts" value={(o.loadouts ?? []) as Loadout[]} />
		</fieldset>
		<fieldset>
			<legend>Its own prices <small>(“can take a Rifle for 5 ducats”)</small></legend>
			<SortableList bind:items={prices} label="Own prices" removable keyOf={(p) => p.key}>
				{#snippet row(p)}
					<div class="row3">
						<input bind:value={p.item} list="dl-item" placeholder="Item" aria-label="Item" />
						<input type="number" min="0" bind:value={p.cost} aria-label="Cost" />
						<select bind:value={p.currency} aria-label="Paid in"><option value="ducats">Ducats</option><option value="glory">Glory</option></select>
					</div>
				{/snippet}
			</SortableList>
			<button type="button" class="ghost" onclick={() => prices.push({ key: k(), item: '', cost: 0, currency: 'ducats' })}>+ Add a price</button>
			<input type="hidden" name="kit_prices" value={JSON.stringify(pricesOut)} /><input type="hidden" name="_sent" value="kit_prices" />
		</fieldset>
		<fieldset>
			<legend>Kit as it carries it</legend>
			<SortableList bind:items={carried} label="Kit as it carries it" removable keyOf={(c) => c.key}>
				{#snippet row(c)}
					<div class="carried">
						<input bind:value={c.item} list="dl-item" placeholder="Item" aria-label="Item" />
						<label>Shield Combo <select bind:value={c.combo}><option value="">as the item says</option><option value="yes">yes</option><option value="no">no</option></select></label>
						<ChipList kinds={['keyword']} list="dl-keyword" upper label="Keywords it loses" placeholder="Keywords it doesn’t have here…" bind:values={c.drop} />
					</div>
				{/snippet}
			</SortableList>
			<button type="button" class="ghost" onclick={() => carried.push({ key: k(), item: '', combo: '', drop: [] })}>+ Add an item</button>
			<input type="hidden" name="kit_items" value={JSON.stringify(carriedOut)} /><input type="hidden" name="_sent" value="kit_items" />
		</fieldset>
		<div class="row3">
			<label>Counts as <small>(for “X only” kit)</small><input name="counts_as" value={o.countsAs ?? ''} list="dl-unit" /></label>
			<label class="tick"><input type="checkbox" name="no_recruit" checked={o.recruit === false} /> Never recruited (gained another way)</label>
		</div>
		<input type="hidden" name="_sent" value="counts_as" /><input type="hidden" name="_sent" value="recruit" />
	</details>

	{#if u.category === 'mercenary'}
		<fieldset class="row3">
			<legend>Hired by <small>(empty: read from the text)</small></legend>
			<label>Alignment <select name="hire_alignment" value={u.kit?.hire?.alignment ?? ''}><option value="">Any</option><option value="faithful">Faithful</option><option value="fallen">Fallen</option></select></label>
			<label>Only these factions or variants <input name="hire_by" value={u.kit?.hire?.by.join(', ') ?? ''} /></label>
		</fieldset>
	{/if}
	{#if u.powers !== null}<label>Powers <input name="powers" value={u.powers ?? ''} /></label>{/if}
	<label>Description <textarea name="description" rows="3">{u.description ?? ''}</textarea></label>
	{@render errors()}
	<div class="actions">
		<button>{u.id ? 'Save' : 'Add unit'}</button>
		{#if saved}<span class="ok" role="status">Saved.</span>{/if}
	</div>
</form>

<style>
	.unit {
		display: grid;
		gap: 12px;
	}
	.preview {
		padding: 10px 14px 12px;
		border: 1px solid var(--blood);
		background: var(--parchment);
		font-size: 0.92rem;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 2px;
		font-size: 1.05rem;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin: 6px 0;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.stats small {
		text-transform: uppercase;
		color: var(--muted);
		font-size: 0.72rem;
		letter-spacing: 0.05em;
	}
	.ab,
	.rule {
		margin: 4px 0 0;
	}
	.rule {
		padding-left: 8px;
		border-left: 2px solid var(--blood);
		color: var(--ink-soft);
	}
	fieldset {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 6px 12px 12px;
		border: 1px solid var(--rule);
	}
	legend {
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	legend small,
	label small {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--muted);
	}
	.grid {
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	label {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
	}
	label > input:not([type='checkbox']),
	label > select,
	label > textarea,
	.row3 > input,
	.row3 > select,
	.ability > *,
	.carried > input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.tick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.ticks {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 0.85rem;
	}
	.sub {
		display: grid;
		gap: 6px;
		padding-left: 10px;
		border-left: 2px solid var(--rule);
	}
	.lbl {
		font-size: 0.85rem;
	}
	.row3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 6px 12px;
		align-items: end;
	}
	.ability,
	.carried {
		display: grid;
		gap: 4px;
	}
	.more {
		display: grid;
		gap: 10px;
	}
	.more[open] {
		display: grid;
	}
	.more summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
		position: sticky;
		bottom: 0;
		padding: 8px 0;
		background: var(--paper);
		border-top: 1px solid var(--rule);
	}
	.ok {
		color: var(--supplies);
	}
	button.ghost {
		justify-self: start;
	}
</style>
