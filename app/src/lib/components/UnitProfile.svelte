<script lang="ts">
	import KeywordChips from './KeywordChips.svelte';

	/** A unit entry as the compendium shows it: name bar, cost and profile, keywords, then folds. */
	interface Profile {
		name: string;
		variant: string | null;
		category: string;
		cost: number;
		currency: 'ducats' | 'glory';
		availabilityMin: number;
		availabilityMax: number | null;
		stats: { movement?: string; ranged?: string; melee?: string; armour?: string; base?: string };
		keywords: string[];
		abilities: { name: string; text: string }[];
		battlekitNote: string | null;
		powers: string | null;
		description: string | null;
	}
	let { unit, glossary = {}, picture = null }: { unit: Profile; glossary?: Record<string, string>; picture?: string | null } = $props();
	const avail = $derived(unit.availabilityMax == null ? 'Any number' : unit.availabilityMin ? `${unit.availabilityMin}–${unit.availabilityMax}` : `Up to ${unit.availabilityMax}`);
	const STATS = [
		['movement', 'Movement'],
		['ranged', 'Ranged'],
		['melee', 'Melee'],
		['armour', 'Armour'],
		['base', 'Base']
	] as const;
</script>

<article class="entry">
	<h3 class="bar">{unit.name}{#if unit.variant}<small>{unit.variant}</small>{/if}</h3>
	<div class="body" class:with-picture={!!picture}>
		<div>
			<dl class="facts">
				<div><dt>Cost</dt><dd>{unit.cost} {unit.currency === 'glory' ? 'Glory' : 'Ducats'}</dd></div>
				<div><dt>Availability</dt><dd>{avail}</dd></div>
			</dl>
			<div class="stats">
				{#each STATS as [k, label] (k)}
					<div><span>{label}</span><strong>{unit.stats[k] ?? '—'}</strong></div>
				{/each}
			</div>
			<KeywordChips keywords={unit.keywords} {glossary} />
		</div>
		{#if picture}<img class="picture" src={picture} alt={unit.name} />{/if}
	</div>
	{#if unit.abilities.length}
		<details>
			<summary>Abilities</summary>
			{#each unit.abilities as a (a.name)}<p><strong>{a.name}:</strong> {a.text}</p>{/each}
		</details>
	{/if}
	{#if unit.battlekitNote}
		<details>
			<summary>Battlekit</summary>
			<p>{unit.battlekitNote}</p>
			{#if unit.powers}<p><strong>Powers:</strong> {unit.powers}</p>{/if}
		</details>
	{/if}
	{#if unit.description}
		<details>
			<summary>Lore</summary>
			<p>{unit.description}</p>
		</details>
	{/if}
</article>

<style>
	.entry {
		border: 1px solid var(--ink);
		background: var(--paper);
	}
	.bar {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin: 0;
		padding: 7px 14px;
		background: var(--blood);
		color: var(--paper);
		border: none;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.35rem;
		text-transform: none;
		letter-spacing: 0;
	}
	.bar small {
		font-family: var(--font-body);
		font-size: 0.8rem;
		opacity: 0.85;
	}
	.body {
		display: grid;
		gap: 12px;
		padding: 12px 14px;
	}
	.body.with-picture {
		grid-template-columns: 1fr 140px;
	}
	.picture {
		width: 140px;
		height: 140px;
		object-fit: cover;
		border: 1px solid var(--ink);
	}
	.facts {
		display: flex;
		gap: 18px;
		margin: 0 0 10px;
	}
	.facts div {
		display: flex;
		gap: 6px;
	}
	dt {
		font-weight: 700;
	}
	dd {
		margin: 0;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}
	.stats div {
		display: grid;
		gap: 2px;
		min-width: 4.5rem;
	}
	.stats span {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.stats strong {
		padding: 4px 8px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		font-weight: 600;
		text-align: center;
		font-variant-numeric: lining-nums;
	}
	details {
		border-top: 1px solid var(--rule);
	}
	summary {
		padding: 8px 14px;
		font-weight: 700;
		cursor: pointer;
	}
	summary:hover {
		color: var(--blood);
	}
	details p {
		margin: 0 14px 10px;
		line-height: 1.5;
	}
	@media (max-width: 36rem) {
		.body.with-picture {
			grid-template-columns: 1fr;
		}
	}
</style>
