<!--
  One homebrew set as a card: its name (a link to the editor), kind and base, who made it (shared sets), private
  or shared, and whether it passes its checks. The same card shape as the warband cards.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { ApiHomebrewCard } from '#lib/schemas/homebrew';

	type Props = { card: ApiHomebrewCard };
	let { card }: Props = $props();
	const h = m.homebrew;
</script>

<article class="card" data-homebrew={card.id}>
	<h3 class="name"><a href="/homebrew/{card.id}">{card.name}</a></h3>
	<p class="dim">
		{h.kinds[card.kind]} · {h.onBase(card.baseName)}{card.mine ? '' : ` · ${h.by(card.ownerName)}`}
	</p>
	<p class="meta data">
		<span class="badge">{card.visibility === 'shared' ? h.sharedBadge : h.private}</span>
		·
		<span class:ok={card.ok} class:bad={!card.ok}
			>{card.ok ? h.passes : h.problems(Math.max(card.problems, 1))}</span
		>
	</p>
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
	.card:hover {
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
	.badge {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.ok {
		color: var(--ok);
	}
	.bad {
		color: var(--warn);
	}
</style>
