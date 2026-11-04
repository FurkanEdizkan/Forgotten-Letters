<!--
  A unit as a card: name, category, cost and availability, stat boxes, keyword chips, abilities, fixed kit and
  upgrades. `compact` (the rules card over the builder) drops the name's link.
-->
<script lang="ts">
	import type { Unit } from '#lib/rules/pack';
	import { peek } from './peek.svelte';
	import { elementHref } from '#lib/rules/text';
	import { m } from '#lib/messages';
	import KeywordChip from './KeywordChip.svelte';
	import RuleText from './RuleText.svelte';
	import { rulesView } from './context';

	type Props = { unit: Unit; compact?: boolean };
	let { unit, compact = false }: Props = $props();
	const view = rulesView();
	const STATS = ['movement', 'ranged', 'melee', 'armour', 'base'] as const;
	const name = (id: string) => view.names[id]?.name ?? id;
</script>

<article class="card" data-unit={unit.id}>
	<header>
		<h3>
			{#if compact}{unit.name}{:else}<a href={elementHref(view.set, unit.id)} use:peek={unit.id}
					>{unit.name}</a
				>{/if}
		</h3>
		<span class="data">{m.rules.price(unit.cost, unit.currency)}</span>
	</header>
	<p class="dim">
		{m.rules.types.unit} · {unit.category} · {m.rules.availability(
			unit.availability.min,
			unit.availability.max
		)}
	</p>
	<dl class="stats">
		{#each STATS as s (s)}
			{#if unit.stats[s]}<div>
					<dt>{m.rules.stats[s]}</dt>
					<dd class="data">{unit.stats[s]}</dd>
				</div>{/if}
		{/each}
	</dl>
	{#if unit.keywords.length}
		<div class="chips">
			{#each unit.keywords as k, i (`${i}:${k.kw}`)}<KeywordChip id={k.kw} value={k.value} />{/each}
		</div>
	{/if}
	{#each unit.abilities as a (a.name)}
		<div class="ability"><strong>{a.name}</strong> <RuleText body={a.text} /></div>
	{/each}
	{#if unit.kit.fixed?.length}
		<p>
			<span class="label">{m.rules.kit}</span>
			{#each unit.kit.fixed as id, i (id)}{i ? ', ' : ' '}<a
					href={elementHref(view.set, id)}
					use:peek={id}>{name(id)}</a
				>{/each}
		</p>
	{/if}
	{#if unit.upgrades?.length}
		<p>
			<span class="label">{m.rules.upgrades}</span>
			{#each unit.upgrades as id, i (id)}{i ? ', ' : ' '}<a
					href={elementHref(view.set, id)}
					use:peek={id}>{name(id)}</a
				>{/each}
		</p>
	{/if}
</article>

<style>
	.card {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		align-items: baseline;
	}
	h3 {
		margin: 0;
		font-size: var(--size-title);
		letter-spacing: var(--track-title);
		text-transform: uppercase;
	}
	h3 a {
		color: var(--bone);
		text-decoration: none;
	}
	p {
		margin: 0;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
	}
	.stats div {
		display: grid;
		min-width: 4.5rem;
		padding: var(--space-1) var(--space-2);
		background: var(--panel-raised);
		text-align: center;
	}
	dt {
		color: var(--bone-dim);
		font-size: var(--size-label);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	dd {
		margin: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.ability strong {
		color: var(--blood-pale);
	}
	a {
		color: var(--blood-pale);
	}
</style>
