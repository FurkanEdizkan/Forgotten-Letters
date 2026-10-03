<script lang="ts">
	/**
	 * Prices set by rule ("the first Sniper costs 10 less", "a Rifle costs a Yeoman 5"): what is bought, for whom,
	 * while what, and the price (a cost, so much less, or a factor). Posts the pack's shape as JSON.
	 */
	import type { PriceRule } from '$lib/warband-limits';
	import { clean } from '$lib/limit-edit';
	import ChipList from './ChipList.svelte';
	import ItemSelEditor from './ItemSelEditor.svelte';
	import ModelSelEditor from './ModelSelEditor.svelte';
	import SortableList from './SortableList.svelte';

	let { value = [], name }: { value?: PriceRule[]; name: string } = $props();

	type Row = PriceRule & { key: number; buys: 'items' | 'entries'; how: 'cost' | 'less' | 'factor' };
	const row = (p: PriceRule): Row => ({ ...structuredClone(p), key: Math.random(), buys: p.entries ? 'entries' : 'items', how: p.factor != null ? 'factor' : p.less != null ? 'less' : 'cost' });
	// svelte-ignore state_referenced_locally
	let rows = $state(value.map(row));
	const out = $derived(
		rows.map(({ key: _k, buys, how, ...p }) => {
			const o = (clean({ ...p, items: undefined, entries: undefined, cost: undefined, currency: undefined, less: undefined, factor: undefined }) ?? {}) as PriceRule;
			if (buys === 'entries') o.entries = p.entries ?? [];
			else o.items = clean(p.items) ?? {};
			if (how === 'cost') Object.assign(o, { cost: p.cost ?? 0 }, p.currency ? { currency: p.currency } : {});
			else if (how === 'less') o.less = p.less ?? 0;
			else o.factor = p.factor ?? 1;
			return o;
		})
	);
	const num = (s: string) => (s === '' ? undefined : Number(s));
</script>

<div class="prices">
	<SortableList bind:items={rows} label="Prices" removable keyOf={(r) => r.key}>
		{#snippet row(r, i)}
			<div class="price">
				<div class="line">
					<label>Buying <select bind:value={r.buys}><option value="items">kit</option><option value="entries">an entry</option></select></label>
					<label>
						Price
						<select bind:value={r.how}><option value="cost">costs</option><option value="less">costs less by</option><option value="factor">costs times</option></select>
					</label>
					{#if r.how === 'cost'}
						<input type="number" min="0" value={r.cost ?? 0} oninput={(e) => (r.cost = num(e.currentTarget.value))} aria-label="Cost" />
						<select value={r.currency ?? 'ducats'} onchange={(e) => (r.currency = e.currentTarget.value as PriceRule['currency'])} aria-label="Paid in"><option value="ducats">Ducats</option><option value="glory">Glory</option></select>
					{:else if r.how === 'less'}
						<input type="number" min="0" value={r.less ?? 0} oninput={(e) => (r.less = num(e.currentTarget.value))} aria-label="Less by" />
					{:else}
						<input type="number" min="0" step="0.5" value={r.factor ?? 1} oninput={(e) => (r.factor = num(e.currentTarget.value))} aria-label="Times" />
					{/if}
					<label class="tick"><input type="checkbox" checked={!!r.first} onchange={(e) => (r.first = e.currentTarget.checked || undefined)} /> only the first</label>
					<label>only copy no. <input type="number" min="1" value={r.copy ?? ''} oninput={(e) => (r.copy = num(e.currentTarget.value))} /></label>
				</div>
				{#if r.buys === 'entries'}
					<ChipList kinds={['unit']} list="dl-unit" label="Price {i + 1}: entries" placeholder="Entries…" bind:values={() => r.entries ?? [], (v) => (r.entries = v)} />
				{:else}
					<ItemSelEditor bind:value={r.items} label="Price {i + 1}: kit" />
				{/if}
				<details open={!!(r.who || r.while)}>
					<summary>For whom, while what…</summary>
					<span class="lbl">Bought for (or as)</span>
					<ModelSelEditor bind:value={r.who} label="Price {i + 1}: for" />
					<span class="lbl">While the warband has</span>
					<ModelSelEditor bind:value={r.while} label="Price {i + 1}: while" placeholder="Name entries…" />
				</details>
			</div>
		{/snippet}
	</SortableList>
	<button type="button" class="ghost" onclick={() => rows.push(row({ items: {}, cost: 0 }))}>+ Add a price</button>
</div>
<input type="hidden" {name} value={JSON.stringify(out)} />
<input type="hidden" name="_sent" value={name} />

<style>
	.prices,
	.price,
	details[open] {
		display: grid;
		gap: 6px;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: center;
		font-size: 0.85rem;
	}
	.line label {
		display: inline-flex;
		gap: 5px;
		align-items: center;
	}
	.line input[type='number'] {
		width: 5rem;
	}
	summary,
	.lbl {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	summary {
		cursor: pointer;
	}
	button.ghost {
		justify-self: start;
	}
</style>
