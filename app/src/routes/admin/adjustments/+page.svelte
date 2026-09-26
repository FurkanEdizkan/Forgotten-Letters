<script lang="ts">
	import { enhance } from '$app/forms';
	import EffectsEditor from '$lib/components/EffectsEditor.svelte';
	import { describeEffect } from '$lib/effects';
	import type { Effect } from '$lib/rules/types';

	let { data, form } = $props();

	let warband = $state('');
	let effects = $state<Effect[]>([]);
	let trade = $state(0);
	const zoneName = (id: string) => data.zones.find((z) => z.id === id)?.name ?? id;

	function addTrade() {
		if (trade > 0) effects.push({ t: 'glory', n: -trade }, { t: 'cvp', n: trade });
		trade = 0;
	}
</script>

<h1>Adjustments</h1>
<p class="muted">
	Glory traded for CVP (Rival Icon, Ritual Sacrifice, Patron's Visit), recurring Tithe Ducats, corrections — anything the
	post-game wizard didn't record.
</p>

<form
	method="POST"
	action="?/add"
	use:enhance={() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') effects = [];
		}}
>
	<label>
		Warband
		<select name="warband" bind:value={warband} required>
			<option value="" disabled>Choose…</option>
			{#each data.warbands as w (w.id)}<option value={w.id}>{w.seat ? `P${w.seat} · ` : ''}{w.player} — {w.name}</option>{/each}
		</select>
	</label>
	<div class="trade">
		<label>Trade Glory for CVP <input type="number" min="0" max="10" bind:value={trade} /></label>
		<button type="button" class="ghost" onclick={addTrade}>Add trade</button>
	</div>
	<EffectsEditor bind:effects zones={data.zones} />
	<label>Note <input name="note" placeholder="e.g. Patron's Visit, game 5" /></label>
	<input type="hidden" name="effects" value={JSON.stringify(effects)} />
	<button disabled={!warband || !effects.length}>Record</button>
	{#if form?.message}<span class="error">{form.message}</span>{/if}
</form>

<h2>Recorded</h2>
<ul>
	{#each data.adjustments as a (a.id)}
		<li>
			<span>
				<strong>{a.player}</strong>: {a.effects.map((e) => describeEffect(e, zoneName)).join(', ')}
				{#if a.note}<small> — {a.note}</small>{/if}
			</span>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={a.id} />
				<button class="ghost">Delete</button>
			</form>
		</li>
	{:else}
		<li class="muted"><em>None yet.</em></li>
	{/each}
</ul>

<style>
	form {
		display: grid;
		gap: 12px;
		justify-items: start;
		padding: 14px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	label {
		display: grid;
		gap: 4px;
	}
	.trade {
		display: flex;
		gap: 8px;
		align-items: end;
	}
	.trade input {
		width: 5em;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
		padding: 6px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	li form {
		padding: 0;
		border: none;
		background: none;
	}
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
		padding: 3px 10px;
	}
	.muted,
	small {
		color: var(--muted);
	}
	.error {
		color: var(--blood);
	}
</style>
