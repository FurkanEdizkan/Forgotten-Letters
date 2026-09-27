<script lang="ts">
	import { keywordKey } from '$lib/keywords';

	/** Keyword chips; each shows its glossary text on hover, focus or tap. */
	let { keywords, glossary = {}, dark = false }: { keywords: string[]; glossary?: Record<string, string>; dark?: boolean } = $props();
	let open = $state<number | null>(null);
</script>

<ul class="chips" class:dark>
	{#each keywords as k, i (i)}
		{@const text = glossary[keywordKey(k)]}
		<li>
			{#if text}
				<button type="button" class="chip" aria-expanded={open === i} onclick={() => (open = open === i ? null : i)} onblur={() => open === i && (open = null)}>{k}</button>
				<span class="tip" class:shown={open === i} role="tooltip">{text}</span>
			{:else}
				<span class="chip plain">{k}</span>
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
		display: inline-block;
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
	.dark .chip {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(236, 229, 211, 0.3);
		color: var(--bone);
	}
	.dark button.chip:hover,
	.dark button.chip[aria-expanded='true'] {
		background: var(--bone);
		color: var(--night);
	}
</style>
