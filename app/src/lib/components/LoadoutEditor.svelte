<script lang="ts">
	/**
	 * The sets of kit an entry must carry one of ("a Great Sword, or a Polearm and a Trench Shield"): each set a row
	 * of slots, each slot one item or a choice of items. Posts the pack's shape as JSON.
	 */
	import type { Loadout } from '$lib/warband-limits';
	import ChipList from './ChipList.svelte';
	import SortableList from './SortableList.svelte';

	let { value = [], name }: { value?: Loadout[]; name: string } = $props();

	type Row = { key: number; slots: { key: number; items: string[] }[] };
	const k = () => Math.random();
	// svelte-ignore state_referenced_locally
	let rows = $state<Row[]>(value.map((l) => ({ key: k(), slots: l.map((s) => ({ key: k(), items: Array.isArray(s) ? [...s] : [s] })) })));
	const out = $derived(
		rows
			.map((r) => r.slots.filter((s) => s.items.length).map((s) => (s.items.length === 1 ? s.items[0] : [...s.items])))
			.filter((l) => l.length) as Loadout[]
	);
	const say = (l: Loadout) => l.map((s) => (Array.isArray(s) ? s.join(' or ') : s)).join(' and ');
</script>

<div class="loadouts">
	<SortableList bind:items={rows} label="Loadouts" removable keyOf={(r) => r.key}>
		{#snippet row(r, i)}
			<div class="set">
				<span class="say">{i ? 'or ' : ''}{say(out[i] ?? []) || 'an empty set'}</span>
				{#each r.slots as s, j (s.key)}
					<div class="slot">
						<ChipList kinds={['item']} list="dl-item" label="Set {i + 1}, slot {j + 1}" placeholder="An item (two or more: a choice)…" bind:values={s.items} />
						<button type="button" class="ghost mini" aria-label="Remove slot {j + 1}" onclick={() => r.slots.splice(j, 1)}>×</button>
					</div>
				{/each}
				<button type="button" class="ghost mini" onclick={() => r.slots.push({ key: k(), items: [] })}>+ Slot</button>
			</div>
		{/snippet}
	</SortableList>
	<button type="button" class="ghost" onclick={() => rows.push({ key: k(), slots: [{ key: k(), items: [] }] })}>+ Add a set</button>
</div>
<input type="hidden" {name} value={JSON.stringify(out)} />
<input type="hidden" name="_sent" value={name} />

<style>
	.loadouts,
	.set {
		display: grid;
		gap: 5px;
	}
	.say {
		font-size: 0.9rem;
		font-weight: 600;
	}
	.slot {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px;
	}
	.mini {
		justify-self: start;
		padding: 1px 8px;
		letter-spacing: 0;
	}
</style>
