<script lang="ts">
	import EffectsEditor from './EffectsEditor.svelte';
	import { follyOffer, lookup, lootFor } from '$lib/rules/exploration';
	import { RESOURCE_NAMES, type Exploration, type Resource, type Zone } from '$lib/rules/types';

	let {
		value = $bindable(),
		tables,
		dicePool = 3,
		zones = [],
		defender = false
	}: {
		value: Exploration;
		/** Tables the roll may use; empty for a defender (no table). */
		tables: Resource[];
		dicePool?: number;
		zones?: Zone[];
		defender?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	let diceText = $state(value.dice.join(' '));
	// svelte-ignore state_referenced_locally
	let modifier = $state(value.total - value.dice.reduce((a, b) => a + b, 0));

	function parseDice(text: string) {
		return text
			.split(/[\s,]+/)
			.map(Number)
			.filter((n) => Number.isInteger(n) && n >= 1 && n <= 6);
	}

	$effect(() => {
		const dice = parseDice(diceText);
		value.dice = dice;
		value.total = dice.reduce((a, b) => a + b, 0) + modifier;
	});

	const row = $derived(value.table ? lookup(value.table, value.total) : undefined);

	$effect(() => {
		if (row && value.result !== row.name) {
			value.result = row.name;
			value.effects = [...(row.effects ?? [])];
		}
	});

	function rollAll() {
		const n = Math.max(1, dicePool);
		diceText = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).join(' ');
	}
</script>

<div class="exp">
	<div class="line">
		<label>
			Dice ({dicePool}D6)
			<input bind:value={diceText} placeholder="4 5 6" inputmode="numeric" />
		</label>
		<button type="button" class="ghost" onclick={rollAll}>Roll</button>
		<label>
			± mod
			<input type="number" bind:value={modifier} class="short" />
		</label>
		<span class="total">= <strong>{value.total}</strong> · loot {lootFor(value.total)} Ducats</span>
	</div>

	{#if defender}
		{#if follyOffer(value.dice)}
			<p class="folly">Three matching dice — agents of Rudolf's Folly make an offer (1 Glory for air support next game).</p>
		{:else}
			<p class="muted">No table for the defender; nothing untoward unless three dice match.</p>
		{/if}
	{:else}
		<label>
			Table
			<select bind:value={value.table}>
				{#each tables as t (t)}<option value={t}>{RESOURCE_NAMES[t]}</option>{/each}
			</select>
		</label>
		{#if row}
			<p class="result"><strong>{row.name}</strong> ({row.min}–{row.max === Infinity ? '+' : row.max}): {row.summary}</p>
		{/if}
	{/if}

	<div>
		<div class="muted">Effects to record</div>
		<EffectsEditor bind:effects={value.effects} {zones} />
	</div>
</div>

<style>
	.exp {
		display: grid;
		gap: 8px;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: end;
	}
	label {
		display: grid;
		gap: 2px;
	}
	.short {
		width: 4.5em;
	}
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
		padding: 5px 10px;
	}
	.result,
	.folly {
		margin: 0;
	}
	.folly {
		color: var(--blood);
		font-weight: 600;
	}
	.muted {
		color: var(--muted);
		margin: 0;
	}
</style>
