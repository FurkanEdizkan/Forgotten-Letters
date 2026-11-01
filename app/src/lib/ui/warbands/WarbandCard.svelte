<!--
  A warband card (DESIGN.md §7, Card): the name in the title style, the faction (and variant or Sin), the rating in
  Ducats and Glory against the ducat limit, games played, how many fighters and problems, and the campaign it sits
  in. The whole card opens the builder; `actions` sit at its foot and `menu` (a ⋮ menu) at its top right, outside
  the link.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/messages';
	import type { ApiWarbandCard } from '#lib/schemas/warbands';

	type Props = { card: ApiWarbandCard; href?: string; actions?: Snippet; menu?: Snippet };
	let { card, href, actions, menu }: Props = $props();
	const sub = $derived(card.variantName ?? card.dedicationName);
	const w = m.warbands;
</script>

<article class="card" class:link={!!href} data-warband={card.id}>
	<h3 class="name">
		{#if href}<a {href}>{card.name}</a>{:else}{card.name}{/if}
	</h3>
	{#if menu}<div class="menu">{@render menu()}</div>{/if}
	<p class="dim">
		{sub ?? card.factionName}{sub ? ` · ${card.factionName}` : ''}
	</p>
	<p class="data">
		<strong>{w.rating(card.rating.ducats, card.rating.glory)}</strong>
		<span class="dim">{w.ofLimit(card.ducatLimit)}</span>
	</p>
	<p class="meta data">
		{w.fighters(card.fighters)} ·
		{#if card.gamesPlayed}{w.games(card.gamesPlayed)} ·{/if}
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
	.menu {
		position: absolute;
		z-index: 2;
		top: var(--space-2);
		right: var(--space-2);
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
