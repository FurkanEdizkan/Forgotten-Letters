<!-- A Battlekit item: name, range, type and category, its keyword chips, its text and the armouries that sell it. -->
<script lang="ts">
	import type { Item } from '#lib/rules/pack';
	import type { Ref } from '#lib/rules/views';
	import { elementHref } from '#lib/rules/text';
	import { m } from '#lib/messages';
	import KeywordChip from './KeywordChip.svelte';
	import RuleText from './RuleText.svelte';
	import { rulesView } from './context';

	type Props = { item: Item; takenBy: Ref[] };
	let { item, takenBy }: Props = $props();
	const view = rulesView();
</script>

<article class="card" data-item={item.id}>
	<h3><a href={elementHref(view.set, item.id)}>{item.name}</a></h3>
	<dl class="meta">
		{#if item.range}<div>
				<dt>{m.rules.range}</dt>
				<dd class="data">{item.range}</dd>
			</div>{/if}
		<div>
			<dt>{m.rules.hands}</dt>
			<dd>{item.type}</dd>
		</div>
		<div>
			<dt>{m.rules.category}</dt>
			<dd>{m.rules.categories[item.category]}</dd>
		</div>
	</dl>
	{#if item.keywords.length}
		<div class="chips">
			{#each item.keywords as k, i (`${i}:${k.kw}`)}<KeywordChip id={k.kw} value={k.value} />{/each}
		</div>
	{/if}
	{#if item.text}<RuleText body={item.text} />{/if}
	<p class="taken">
		<span class="label">{m.rules.takenBy}</span>
		{#if takenBy.length}
			{#each takenBy as t, i (`${i}:${t.id}`)}{i ? ', ' : ' '}<a href={elementHref(view.set, t.id)}
					>{t.name}</a
				>{/each}
		{:else}
			<span class="dim">{m.rules.nobody}</span>
		{/if}
	</p>
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
	h3 a:hover {
		text-decoration: underline;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin: 0;
	}
	.meta div {
		display: grid;
	}
	dt {
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
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
	.taken {
		margin: 0;
	}
	.taken a {
		color: var(--blood-pale);
	}
</style>
