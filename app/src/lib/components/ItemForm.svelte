<script lang="ts">
	/** One armoury item in the Rules Editor: its profile, who may take it, and the rules for models carrying it. */
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import { explain } from '$lib/keywords';
	import { ITEM_CATEGORIES } from '$lib/faction-template';
	import { describeLimit, type Limit, type ModelSel } from '$lib/warband-limits';
	import type { ItemFacts, StipulationsOverride } from '$lib/warband-rules';
	import ChipList from './ChipList.svelte';
	import KeywordChips from './KeywordChips.svelte';
	import LimitEditor from './LimitEditor.svelte';
	import ModelSelEditor from './ModelSelEditor.svelte';
	import RulesText from './RulesText.svelte';

	type Item = {
		id: string;
		name: string;
		category: string;
		cost: number;
		currency: string;
		limit: number | null;
		restrictions: string | null;
		type: string | null;
		range: string | null;
		keywords: string[];
		text: string | null;
		description: string | null;
		unique: boolean;
		stipulations: StipulationsOverride | null;
	};
	let { i, facts, glossary, errors, saved }: { i: Item; facts: ItemFacts | undefined; glossary: Record<string, string>; errors: Snippet; saved: boolean } = $props();

	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const TICKS = [
		['shield_combo', 'shieldCombo', 'Shield Combo'],
		['bayonet_lug', 'bayonetLug', 'Bayonet Lug'],
		['consumable', 'consumable', 'Consumable'],
		['headgear', 'headgear', 'Headgear'],
		['exploration_only', 'explorationOnly', 'Exploration only']
	] as const;

	// Seeded once: the parent keys this form by item.
	const [I, F] = (() => [i, facts] as const)();
	const st = I.stipulations ?? {};
	let name = $state(I.name);
	let cost = $state(I.cost);
	let currency = $state(I.currency);
	let range = $state(I.range ?? '');
	let keywords = $state([...I.keywords]);
	let text = $state(I.text ?? '');
	let only = $state([...(F?.only ?? [])]);
	let limits = $state<Limit[]>(st.limits ?? []);
	let excludes = $state<ModelSel | undefined>(st.limitExcludes);
	const titleOf = (v: string) => explain(glossary, v) ?? 'No explanation yet: add one in Keywords.';
</script>

<form method="POST" action="?/item" use:enhance={keep} class="item">
	<input type="hidden" name="id" value={i.id} />

	<section class="preview" aria-label="How it reads in the builder">
		<div class="card-head"><b>{name || 'New item'}</b><span>{cost} {currency === 'glory' ? 'Glory' : 'Ducats'}</span></div>
		{#if range}<p class="ab"><small>Range</small> {range}</p>{/if}
		<KeywordChips {keywords} {glossary} />
		{#if text}<p class="ab"><RulesText {text} {glossary} /></p>{/if}
		{#if only.length}<p class="ab"><b>Only:</b> {only.join(', ')}</p>{/if}
		{#each limits as l, n (n)}<p class="rule">{l.text ?? describeLimit(l)}</p>{/each}
	</section>

	<fieldset class="grid">
		<legend>Profile</legend>
		<label class="wide">Name <input name="name" bind:value={name} required /></label>
		<label>Kind <select name="category" value={i.category}>{#each ITEM_CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}</select></label>
		<label>Type <select name="type" value={i.type ?? ''}><option value="">—</option>{#each ['1-Handed', '2-Handed', 'Grenade', 'Armour', 'Shield', 'Equipment', 'Special'] as t (t)}<option value={t}>{t}</option>{/each}</select></label>
		<label>Range <input name="range" bind:value={range} placeholder={'24" or Melee'} /></label>
		<label>Cost <input name="cost" type="number" min="0" bind:value={cost} /></label>
		<label>In <select name="currency" bind:value={currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
		<label>Limit <small>(warband)</small><input name="limit" type="number" min="0" value={i.limit ?? ''} /></label>
		<label>Per model <input name="per_model" type="number" min="0" value={facts?.perModel ?? ''} /></label>
	</fieldset>

	<fieldset>
		<legend>Keywords</legend>
		<ChipList name="keywords" kinds={['keyword']} list="dl-keyword" upper label="{name || 'Item'} keywords" placeholder="Add a keyword, or drag one from the library…" bind:values={keywords} {titleOf} />
	</fieldset>

	<fieldset>
		<legend>Who may take it</legend>
		<span class="lbl">Only for <small>(entries, ELITE or keywords; empty: anyone)</small></span>
		<ChipList name="only" kinds={['unit', 'keyword']} list="dl-unit" label="Only for" placeholder="Anyone, or name who…" bind:values={only} />
		<div class="ticks">
			{#each TICKS as [n, key, label] (n)}<label class="tick"><input type="checkbox" name={n} checked={!!facts?.[key]} /> {label}</label>{/each}
			<label class="tick"><input type="checkbox" name="unique" checked={i.unique} /> Unique to this faction (•)</label>
		</div>
		<div class="row3">
			<label>Alignment <select name="alignment" value={st.alignment ?? ''}><option value="">Any</option><option value="faithful">Faithful</option><option value="fallen">Fallen</option></select></label>
		</div>
		<span class="lbl">Only these factions <small>(for kit any warband may get)</small></span>
		<ChipList name="factions" kinds={['unit']} list="dl-faction" label="Only these factions" placeholder="Any faction…" values={st.factions ?? []} />
		<input type="hidden" name="_sent" value="alignment" />
	</fieldset>

	<fieldset>
		<legend>Rules for models carrying it</legend>
		<LimitEditor name="stip_limits" label="{name || 'Item'} rules" scope="the models carrying it" bind:value={limits} />
	</fieldset>

	<details class="more" open={!!(excludes || st.dropKeywords?.length)}>
		<summary>Models outside its Limit, keywords it loses…</summary>
		<fieldset>
			<legend>Models whose copies don’t count towards its Limit</legend>
			<ModelSelEditor bind:value={excludes} label="Outside its Limit" placeholder="None, or name entries…" />
			<input type="hidden" name="stip_limit_excludes" value={JSON.stringify(excludes ?? null)} /><input type="hidden" name="_sent" value="stip_limit_excludes" />
		</fieldset>
		<fieldset>
			<legend>Keywords it doesn’t have</legend>
			<ChipList name="drop_keywords" kinds={['keyword']} list="dl-keyword" upper label="Keywords it loses" placeholder="None…" values={st.dropKeywords ?? []} />
		</fieldset>
	</details>

	<label>Rules text <textarea name="text" rows="3" bind:value={text}></textarea></label>
	<label>Description <textarea name="description" rows="2">{i.description ?? ''}</textarea></label>
	{@render errors()}
	<div class="actions">
		<button>{i.id ? 'Save' : 'Add item'}</button>
		{#if saved}<span class="ok" role="status">Saved.</span>{/if}
	</div>
</form>

<style>
	.item {
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
	.ab,
	.rule {
		margin: 4px 0 0;
	}
	.ab small {
		text-transform: uppercase;
		color: var(--muted);
		font-size: 0.72rem;
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
	small {
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
	label > textarea {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.lbl {
		font-size: 0.85rem;
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
	.row3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 6px 12px;
	}
	.more {
		display: grid;
		gap: 10px;
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
</style>
