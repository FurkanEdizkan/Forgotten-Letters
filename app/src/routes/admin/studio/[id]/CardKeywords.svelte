<script lang="ts">
	/**
	 * A card's keywords, edited in place: coloured chips with ×, a field to add one (with suggestions), and a drop
	 * target for keywords dragged from the library.
	 */
	import { explain } from '$lib/keywords';
	import { lookOf, titleCase, type Look } from '$lib/keyword-look';
	import Mark, { type MarkName } from '$lib/components/Mark.svelte';
	import { accepts, drag, endDrag } from '$lib/components/drag.svelte';

	let { keywords, glossary, onchange }: { keywords: string[]; glossary: Record<string, string>; onchange: (k: string[]) => void } = $props();
	const MARK: Record<Look, MarkName> = { bonus: 'die', attack: 'burst', kit: 'grip', harm: 'drop', body: 'figure', ground: 'ground', tag: 'tag' };
	let over = $state(false);
	let text = $state('');
	const add = (k: string) => {
		const t = k.trim().toUpperCase();
		if (t && !keywords.includes(t)) onchange([...keywords, t]);
	};
</script>

<div
	class="kws"
	class:over
	role="group"
	aria-label="Keywords"
	ondragover={(e) => accepts(['keyword']) && (e.preventDefault(), (over = true))}
	ondragleave={() => (over = false)}
	ondrop={(e) => {
		if (!accepts(['keyword'])) return;
		e.preventDefault();
		e.stopPropagation();
		over = false;
		if (typeof drag.value === 'string') add(drag.value);
		endDrag();
	}}
>
	{#each keywords as k (k)}
		{@const look = lookOf(k)}
		<span class="chip look-{look}" title={explain(glossary, k) ?? 'No explanation yet'}>
			{#if look !== 'tag'}<Mark name={MARK[look]} />{/if}{titleCase(k)}<button type="button" aria-label="Remove {k}" onclick={() => onchange(keywords.filter((x) => x !== k))}>×</button>
		</span>
	{/each}
	<input
		bind:value={text}
		list="dl-keyword"
		placeholder="+ keyword"
		aria-label="Add a keyword"
		onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), add(text), (text = ''))}
		onchange={() => (add(text), (text = ''))}
	/>
</div>

<style>
	.kws {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
		min-height: 1.9rem;
	}
	.kws.over {
		outline: 2px dashed var(--blood-bright);
		outline-offset: 2px;
	}
	.chip {
		--edge: rgba(236, 229, 211, 0.3);
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 2px 2px 7px;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(236, 229, 211, 0.16);
		border-left: 3px solid var(--edge);
		font-size: 0.8rem;
		cursor: help;
	}
	.chip :global(.mark) {
		color: var(--edge);
	}
	.look-bonus {
		--edge: var(--look-bonus);
	}
	.look-attack {
		--edge: var(--look-attack);
	}
	.look-kit {
		--edge: var(--look-kit);
	}
	.look-harm {
		--edge: var(--look-harm);
	}
	.look-body {
		--edge: var(--look-body);
	}
	.look-ground {
		--edge: var(--look-ground);
	}
	button {
		padding: 0 5px;
		border: 0;
		background: none;
		color: var(--bone-dim);
		font-size: 0.95rem;
		line-height: 1;
	}
	button:hover {
		background: none;
		color: var(--blood-bright);
	}
	input {
		width: 6.5rem;
		padding: 2px 6px;
		border: 1px dashed rgba(236, 229, 211, 0.25);
		background: transparent;
		color: var(--bone);
		font-size: 0.8rem;
	}
	input:focus {
		border-color: var(--bone-dim);
		box-shadow: none;
	}
</style>
