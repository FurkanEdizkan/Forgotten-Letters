<!--
  A warband card (DESIGN.md §7, Card): the name in the title style, the faction (and variant), the rating in Ducats
  and Glory against the ducat limit, how many fighters and problems, and the campaign it sits in. The whole card
  opens the builder; `actions` sit at its foot, outside the link.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/messages';
	import type { ApiWarbandCard } from '#lib/schemas/warbands';

	type Props = { card: ApiWarbandCard; href?: string; actions?: Snippet };
	let { card, href, actions }: Props = $props();
	const w = m.warbands;
</script>

<article class="card" class:link={!!href} data-warband={card.id}>
	<h3 class="name">
		{#if href}<a {href}>{card.name}</a>{:else}{card.name}{/if}
	</h3>
	<p class="dim">
		{card.variantName ?? card.factionName}{card.variantName ? ` · ${card.factionName}` : ''}
	</p>
	<p class="data">
		<strong>{w.rating(card.rating.ducats, card.rating.glory)}</strong>
		<span class="dim">{w.ofLimit(card.ducatLimit)}</span>
	</p>
	<p class="meta data">
		{w.fighters(card.fighters)} ·
		<span class:ok={!card.problems} class:bad={card.problems > 0}
			>{card.problems ? w.problems(card.problems) : w.noProblems}</span
		>
		· {card.seat ? w.inSeat(card.seat.campaignName) : w.notSeated}
	</p>
	{#if actions}<div class="act">{@render actions()}</div>{/if}
</article>

<style>
	.card {
		position: relative;
		display: grid;
		gap: var(--space-1);
		align-content: start;
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
	}
	.link:hover {
		background: var(--panel-hover);
	}
	.name {
		padding: 0;
		border: 0;
		overflow-wrap: anywhere;
	}
	.name a {
		color: var(--bone);
		text-decoration: none;
	}
	.name a::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.name a:focus-visible {
		outline: none;
	}
	.card:has(.name a:focus-visible) {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.meta {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.ok {
		color: var(--ok);
	}
	.bad {
		color: var(--warn);
	}
	.act {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
</style>
