<script lang="ts">
	/** Which battlekit: by name, kind, hands, keyword, cost, and "other than". Every key given must hold. */
	import type { ItemSel } from '$lib/warband-limits';
	import { clean } from '$lib/limit-edit';
	import ChipList from './ChipList.svelte';
	import Self from './ItemSelEditor.svelte';

	let { value = $bindable(), label = 'Kit' }: { value: ItemSel | undefined; label?: string } = $props();

	const CATS = { ranged: 'Ranged', melee: 'Melee', grenade: 'Grenades', armour: 'Armour', shield: 'Shields', equipment: 'Equipment', special: 'Special' } as const;
	const TYPES = ['1-Handed', '2-Handed'];
	const set = <K extends keyof ItemSel>(k: K, v: ItemSel[K]) => (value = clean({ ...(value ?? {}), [k]: v }));
	const toggle = <T extends string>(xs: T[] | undefined, x: T) => (xs?.includes(x) ? xs.filter((y) => y !== x) : [...(xs ?? []), x]);
	let showNot = $state(!!value?.not);
	const num = (s: string) => (s === '' ? undefined : Math.max(0, Number(s)));
</script>

<div class="sel">
	<ChipList kinds={['item']} list="dl-item" label="{label}: by name" placeholder="Any item, or name some…" bind:values={() => value?.names ?? [], (v) => set('names', v)} />
	<div class="ticks" role="group" aria-label="{label}: kinds">
		{#each Object.entries(CATS) as [c, l] (c)}
			<label class="tick"><input type="checkbox" checked={!!value?.categories?.includes(c as keyof typeof CATS)} onchange={() => set('categories', toggle(value?.categories, c as keyof typeof CATS))} /> {l}</label>
		{/each}
		<span class="sep"></span>
		{#each TYPES as t (t)}
			<label class="tick"><input type="checkbox" checked={!!value?.types?.includes(t)} onchange={() => set('types', toggle(value?.types, t))} /> {t}</label>
		{/each}
	</div>
	<ChipList kinds={['keyword']} list="dl-keyword" upper label="{label}: with a keyword" placeholder="With a keyword…" bind:values={() => value?.keywords ?? [], (v) => set('keywords', v)} />
	<div class="row">
		<label>Costing from <input type="number" min="0" value={value?.min_cost ?? ''} oninput={(e) => set('min_cost', num(e.currentTarget.value))} /></label>
		<label>to <input type="number" min="0" value={value?.max_cost ?? ''} oninput={(e) => set('max_cost', num(e.currentTarget.value))} /></label>
		<label>
			in
			<select value={value?.currency ?? ''} onchange={(e) => set('currency', (e.currentTarget.value || undefined) as ItemSel['currency'])}>
				<option value="">either</option><option value="ducats">Ducats</option><option value="glory">Glory</option>
			</select>
		</label>
	</div>
	<details bind:open={showNot}>
		<summary>Other than…</summary>
		{#if showNot}<Self bind:value={() => value?.not, (v) => set('not', v)} label="{label}: other than" />{/if}
	</details>
</div>

<style>
	.sel {
		display: grid;
		gap: 5px;
	}
	.ticks {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		font-size: 0.85rem;
	}
	.tick {
		display: inline-flex;
		gap: 4px;
		align-items: center;
	}
	.sep {
		width: 1px;
		background: var(--rule);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		font-size: 0.85rem;
	}
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
	details[open] > :global(.sel) {
		margin: 4px 0 0 12px;
		padding-left: 10px;
		border-left: 2px solid var(--rule);
	}
</style>
