<!--
  A campaign card (DESIGN.md §7, Campaign card): the name in the title style with your role badge beside it, then
  the type chip and the stage badge, then one line of at most three facts. With `href` the whole card opens the
  campaign; `actions` (Ask to join, Restore) sit at the foot, outside the link.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/messages';
	import { cardFacts, roleOn, type CardFacts } from './campaign-facts';
	import CampaignRoleBadge from './CampaignRoleBadge.svelte';
	import StageBadge from './StageBadge.svelte';

	type Props = {
		card: CardFacts & { name: string; kind: 'carcass_front' | 'generic' };
		href?: string;
		/** Replaces the facts line, for example "deleted 3 Nov". */
		facts?: string[];
		actions?: Snippet;
	};
	let { card, href, facts, actions }: Props = $props();

	const role = $derived(roleOn(card));
	const line = $derived((facts ?? cardFacts(card)).join(' · '));
</script>

<article class="card" class:link={!!href}>
	<div class="nm">
		<h3 class="name">
			{#if href}<a {href}>{card.name}</a>{:else}{card.name}{/if}
		</h3>
		{#if role}<CampaignRoleBadge {role} />{/if}
	</div>
	<div class="tags">
		<span class="chip">{m.campaigns.kinds[card.kind]}</span>
		<StageBadge stage={card.stage} />
	</div>
	<p class="meta data">{line}</p>
	{#if actions}<div class="act">{@render actions()}</div>{/if}
</article>

<style>
	.card {
		position: relative;
		display: grid;
		gap: var(--space-2);
		align-content: start;
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
		transition: background-color var(--duration-fast) var(--easing);
	}
	.link:hover {
		background: var(--panel-hover);
	}
	.nm {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.name {
		min-width: 0;
		padding: 0;
		border: 0;
		overflow-wrap: anywhere;
	}
	.name a {
		color: var(--bone);
		text-decoration: none;
	}
	/* The name's link covers the card, so the whole card is one target; actions sit above it. */
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
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.chip {
		padding: 0 var(--space-2);
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule);
		font-size: var(--size-label);
		line-height: 1.6;
		white-space: nowrap;
	}
	.meta {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.act {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-1);
	}
</style>
