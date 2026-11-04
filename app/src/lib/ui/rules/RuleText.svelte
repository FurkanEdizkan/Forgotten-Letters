<!--
  Rules text from a folder: `## ` headings, paragraphs and `- ` lists, with `[[id]]` links to elements. Keyword links
  become keyword chips with their pop-up. Built from the parsed tree (lib/rules/text), never as HTML.
-->
<script lang="ts">
	import { peek } from './peek.svelte';
	import { blocks, elementHref, type Inline } from '#lib/rules/text';
	import { typeOf } from '#lib/rules/pack';
	import KeywordChip from './KeywordChip.svelte';
	import { rulesView } from './context';

	type Props = { body: string | undefined | null };
	let { body }: Props = $props();
	const view = rulesView();
	const parsed = $derived(blocks(body ?? ''));
</script>

{#snippet runs(
	list: Inline[]
)}{#each list as r, i (i)}{#if r.t === 'text'}{r.text}{:else if typeOf(r.id) === 'kw'}<KeywordChip
				id={r.id}
				label={r.label}
			/>{:else}<a href={elementHref(view.set, r.id)} use:peek={r.id}
				>{r.label ?? view.names[r.id]?.name ?? r.id}</a
			>{/if}{/each}{/snippet}

<div class="text">
	{#each parsed as b, i (i)}
		{#if b.t === 'h'}
			<h4>{@render runs(b.text)}</h4>
		{:else if b.t === 'p'}
			<p>{@render runs(b.text)}</p>
		{:else}
			<ul>
				{#each b.items as item, j (j)}<li>{@render runs(item)}</li>{/each}
			</ul>
		{/if}
	{/each}
</div>

<style>
	.text {
		display: grid;
		gap: var(--space-2);
		max-width: var(--measure);
	}
	.text :global(p),
	.text ul {
		margin: 0;
	}
	h4 {
		margin: var(--space-2) 0 0;
		font-size: var(--size-title);
		letter-spacing: var(--track-title);
		text-transform: uppercase;
	}
	a {
		color: var(--blood-pale);
	}
</style>
