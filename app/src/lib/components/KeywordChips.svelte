<script lang="ts">
	import { explain } from '$lib/keywords';
	import { LOOKS, lookOf, titleCase, type Look } from '$lib/keyword-look';
	import { getContext } from 'svelte';
	import Mark, { type MarkName } from './Mark.svelte';

	/**
	 * Keyword chips; each shows its glossary text on hover, focus or tap, and its kind as a drawn mark (on the dark
	 * warband pages also a coloured edge). `looks` gives keywords their library-set kind.
	 */
	let {
		keywords,
		glossary = {},
		looks = getContext<Record<string, string | null> | undefined>('keyword-looks'),
		dark = false
	}: { keywords: string[]; glossary?: Record<string, string>; looks?: Record<string, string | null>; dark?: boolean } = $props();
	const MARK: Record<Look, MarkName> = { bonus: 'die', attack: 'burst', kit: 'grip', harm: 'drop', body: 'figure', ground: 'ground', tag: 'tag' };
	let open = $state<number | null>(null);
</script>

<ul class="chips" class:dark>
	{#each keywords as k, i (i)}
		{@const text = explain(glossary, k)}
		{@const look = lookOf(k, looks)}
		{@const label = dark ? titleCase(k) : k}
		<li>
			{#if text}
				<button type="button" class="chip look-{look}" title={LOOKS[look]} aria-expanded={open === i} onclick={() => (open = open === i ? null : i)} onblur={() => open === i && (open = null)}
					>{#if look !== 'tag'}<Mark name={MARK[look]} />{/if}{label}</button
				>
				<span class="tip" class:shown={open === i} role="tooltip">{text}</span>
			{:else}
				<span class="chip plain look-{look}">{#if look !== 'tag'}<Mark name={MARK[look]} />{/if}{label}</span>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		border: 1px solid var(--ink);
		border-left-width: 1px;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		line-height: 1.5;
		cursor: help;
	}
	button.chip:hover,
	button.chip[aria-expanded='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.chip.plain {
		cursor: default;
		border-color: var(--rule);
		color: var(--ink-soft);
	}
	.tip {
		white-space: pre-line;
		position: absolute;
		z-index: 20;
		left: 0;
		top: calc(100% + 6px);
		width: min(22rem, 80vw);
		padding: 10px 12px;
		background: var(--paper);
		color: var(--ink);
		border: 1px solid var(--blood);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		font-size: 0.88rem;
		line-height: 1.45;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		visibility: hidden;
		opacity: 0;
		transition: opacity 0.15s var(--ease-out);
	}
	/* Hidden tips take no room (they would otherwise widen a phone page). */
	.tip:not(.shown) {
		display: none;
	}
	li:hover .tip,
	.tip.shown {
		display: block;
		visibility: visible;
		opacity: 1;
	}
	/* The warband pages' dark register: Trench Companion-like chips, title-case, with the kind's colour on the left edge. */
	.dark .chip {
		--edge: rgba(236, 229, 211, 0.3);
		padding: 4px 10px 4px 8px;
		background: rgba(255, 255, 255, 0.07);
		border-color: rgba(236, 229, 211, 0.16);
		border-left: 3px solid var(--edge);
		color: var(--bone);
		font-size: 0.88rem;
		letter-spacing: 0.01em;
		text-transform: none;
	}
	.dark .chip :global(.mark) {
		color: var(--edge);
		font-size: 1.05em;
	}
	.dark .look-bonus {
		--edge: #8fb04a;
	}
	.dark .look-attack {
		--edge: #6aa2d6;
	}
	.dark .look-kit {
		--edge: #b583d4;
	}
	.dark .look-harm {
		--edge: #e0574b;
	}
	.dark .look-body {
		--edge: #e0a23a;
	}
	.dark .look-ground {
		--edge: #55aab4;
	}
	.dark .look-tag :global(.mark) {
		color: var(--bone-dim);
	}
	.dark button.chip:hover,
	.dark button.chip[aria-expanded='true'] {
		background: var(--bone);
		color: var(--night);
	}
</style>
