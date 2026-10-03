<script lang="ts">
	/** Which models: by entry, kind, keyword, upgrade, Skill, the kit they hold, worth, base, and "but not". */
	import type { ModelSel } from '$lib/warband-limits';
	import { clean } from '$lib/limit-edit';
	import ChipList from './ChipList.svelte';
	import ItemSelEditor from './ItemSelEditor.svelte';
	import Self from './ModelSelEditor.svelte';

	let { value = $bindable(), label = 'Models', placeholder = 'Any model, or name entries…' }: { value: ModelSel | undefined; label?: string; placeholder?: string } = $props();

	const CATS = { elite: 'Elite', troop: 'Troop', mercenary: 'Mercenary' } as const;
	const set = <K extends keyof ModelSel>(k: K, v: ModelSel[K]) => (value = clean({ ...(value ?? {}), [k]: v }));
	const toggle = <T extends string>(xs: T[] | undefined, x: T) => (xs?.includes(x) ? xs.filter((y) => y !== x) : [...(xs ?? []), x]);
	const num = (s: string) => (s === '' ? undefined : Math.max(0, Number(s)));
	let showNot = $state(!!value?.not);
	let showHolding = $state(!!value?.holding);
	const more = $derived(!!(value?.upgrades || value?.skills || value?.holding || value?.value_under != null || value?.base_over != null || value?.not));
</script>

<div class="sel">
	<ChipList kinds={['unit']} list="dl-unit" label="{label}: entries" {placeholder} bind:values={() => value?.entries ?? [], (v) => set('entries', v)} />
	<div class="ticks" role="group" aria-label="{label}: kinds">
		{#each Object.entries(CATS) as [c, l] (c)}
			<label class="tick"><input type="checkbox" checked={!!value?.category?.includes(c as keyof typeof CATS)} onchange={() => set('category', toggle(value?.category, c as keyof typeof CATS))} /> {l}</label>
		{/each}
	</div>
	<ChipList kinds={['keyword']} list="dl-keyword" upper label="{label}: with a keyword" placeholder="With a keyword…" bind:values={() => value?.keywords ?? [], (v) => set('keywords', v)} />
	<details open={more}>
		<summary>Upgrades, Skills, kit held, worth, base, but not…</summary>
		<div class="sel inner">
			<ChipList kinds={['upgrade']} list="dl-upgrade" label="{label}: with an upgrade" placeholder="With an upgrade (name, group or keyword)…" bind:values={() => value?.upgrades ?? [], (v) => set('upgrades', v)} />
			<ChipList kinds={['skill']} list="dl-skill" label="{label}: with a Skill" placeholder="With a Skill or scar…" bind:values={() => value?.skills ?? [], (v) => set('skills', v)} />
			<div class="row">
				<label>Worth under <input type="number" min="0" value={value?.value_under ?? ''} oninput={(e) => set('value_under', num(e.currentTarget.value))} /> Ducats</label>
				<label>Base over <input type="number" min="0" value={value?.base_over ?? ''} oninput={(e) => set('base_over', num(e.currentTarget.value))} /> mm</label>
			</div>
			<details bind:open={showHolding}>
				<summary>Holding…</summary>
				{#if showHolding}<ItemSelEditor bind:value={() => value?.holding, (v) => set('holding', v)} label="{label}: holding" />{/if}
			</details>
			<details bind:open={showNot}>
				<summary>But not…</summary>
				{#if showNot}<Self bind:value={() => value?.not, (v) => set('not', v)} label="{label}: but not" placeholder="Name entries…" />{/if}
			</details>
		</div>
	</details>
</div>

<style>
	.sel {
		display: grid;
		gap: 5px;
	}
	.inner {
		margin: 4px 0 0 12px;
		padding-left: 10px;
		border-left: 2px solid var(--rule);
	}
	.ticks,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		font-size: 0.85rem;
	}
	.tick,
	.row label {
		display: inline-flex;
		gap: 5px;
		align-items: center;
	}
	.row input {
		width: 5rem;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
</style>
