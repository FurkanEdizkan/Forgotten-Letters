<script lang="ts">
	/** Rules text with the keywords it names explained on hover, focus or tap. */
	import { segments } from '$lib/rules-text';

	let { text, glossary = {} }: { text: string; glossary?: Record<string, string> } = $props();
	let open = $state<number | null>(null);
</script>

{#each segments(text, glossary) as s, i (i)}{#if s.keyword}<span class="kw"
			><button type="button" aria-expanded={open === i} onclick={() => (open = open === i ? null : i)} onblur={() => open === i && (open = null)}>{s.text}</button><span
				class="tip"
				class:shown={open === i}
				role="tooltip">{s.rule}</span
			></span
		>{:else}{s.text}{/if}{/each}

<style>
	.kw {
		position: relative;
	}
	button {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		cursor: help;
	}
	.tip {
		display: none;
		position: absolute;
		z-index: 20;
		left: 0;
		top: 1.5em;
		width: min(22rem, 70vw);
		padding: 8px 10px;
		background: #1b1915;
		color: var(--bone, #ece5d3);
		border: 1px solid rgba(236, 229, 211, 0.25);
		font-size: 0.82rem;
		line-height: 1.4;
		white-space: pre-line;
		text-transform: none;
	}
	.kw:hover .tip,
	.kw:focus-within .tip,
	.tip.shown {
		display: block;
	}
</style>
