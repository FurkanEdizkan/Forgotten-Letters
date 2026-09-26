<script lang="ts">
	import { EFFECT_KINDS, blankEffect } from '$lib/effects';
	import { RESOURCES, RESOURCE_NAMES, type Effect, type Zone } from '$lib/rules/types';

	let { effects = $bindable([]), zones = [] }: { effects: Effect[]; zones?: Zone[] } = $props();

	const field = (t: Effect['t']) => EFFECT_KINDS.find((k) => k.t === t)?.field ?? null;

	function change(i: number, t: Effect['t']) {
		effects[i] = blankEffect(t);
	}
	function set<K extends string>(i: number, key: K, value: unknown) {
		effects[i] = { ...effects[i], [key]: value } as Effect;
	}
</script>

<div class="effects">
	{#each effects as e, i (i)}
		<div class="row">
			<select value={e.t} onchange={(ev) => change(i, ev.currentTarget.value as Effect['t'])}>
				{#each EFFECT_KINDS as k (k.t)}<option value={k.t}>{k.label}</option>{/each}
			</select>
			{#if field(e.t) === 'n' && 'n' in e}
				<input type="number" value={e.n} oninput={(ev) => set(i, 'n', Number(ev.currentTarget.value))} />
			{:else if field(e.t) === 'track' && 'track' in e}
				<select value={e.track} onchange={(ev) => set(i, 'track', ev.currentTarget.value)}>
					{#each RESOURCES as r (r)}<option value={r}>{RESOURCE_NAMES[r]}</option>{/each}
				</select>
			{:else if field(e.t) === 'tier' && 'tier' in e}
				<select value={String(e.tier)} onchange={(ev) => set(i, 'tier', Number(ev.currentTarget.value))}>
					{#each [5, 8, 12] as n (n)}<option value={String(n)}>up to {n} Glory</option>{/each}
				</select>
			{:else if field(e.t) === 'kind' && 'kind' in e}
				<select value={e.kind} onchange={(ev) => set(i, 'kind', ev.currentTarget.value)}>
					{#each ['shrine', 'vault', 'depot', 'garrison'] as k (k)}<option value={k}>{k}</option>{/each}
				</select>
			{:else if field(e.t) === 'zone' && 'zone' in e}
				<select value={e.zone} onchange={(ev) => set(i, 'zone', ev.currentTarget.value)}>
					<option value="" disabled>Zone…</option>
					{#each zones.filter((z) => z.type !== 'entry') as z (z.id)}<option value={z.id}>{z.name}</option>{/each}
				</select>
			{:else if field(e.t) === 'text' && 'text' in e}
				<input value={e.text} oninput={(ev) => set(i, 'text', ev.currentTarget.value)} />
			{/if}
			<button type="button" class="x" aria-label="Remove" onclick={() => effects.splice(i, 1)}>×</button>
		</div>
	{/each}
	<button type="button" class="add" onclick={() => effects.push(blankEffect('cvp'))}>+ effect</button>
</div>

<style>
	.effects {
		display: grid;
		gap: 6px;
		justify-items: start;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	input[type='number'] {
		width: 5.5em;
	}
	.x,
	.add {
		padding: 2px 10px;
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
	}
	.add {
		font-size: 0.9em;
	}
</style>
