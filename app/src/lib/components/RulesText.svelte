<script lang="ts">
	/** Rules text with the keywords it names explained on hover, focus or tap. */
	import { getContext } from 'svelte';
	import { segments } from '$lib/rules-text';
	import { lookOf } from '$lib/keyword-look';

	let { text, glossary = {} }: { text: string; glossary?: Record<string, string> } = $props();
	const looks = getContext<Record<string, string | null> | undefined>('keyword-looks');
	let open = $state<number | null>(null);
	/** A rule's name where a paragraph opens with one ("* Quick Bursts: …"), to set it apart as the book does. */
	function heads(t: string, first: boolean) {
		const out: { text: string; head: boolean }[] = [];
		let last = 0;
		for (const m of t.matchAll(/(^|\n)([ \t]*\*?[ \t]*)([A-Z][\w'’ !-]{1,40}?):/g)) {
			if (!m[1] && !first) continue;
			const at = m.index + m[1].length + m[2].length;
			out.push({ text: t.slice(last, at), head: false }, { text: `${m[3]}:`, head: true });
			last = at + m[3].length + 1;
		}
		out.push({ text: t.slice(last), head: false });
		return out;
	}
</script>

{#each segments(text, glossary) as s, i (i)}{#if s.keyword}<span class="kw look-{lookOf(s.text, looks)}"
			><button type="button" aria-expanded={open === i} onclick={() => (open = open === i ? null : i)} onblur={() => open === i && (open = null)}>{s.text}</button><span
				class="tip"
				class:shown={open === i}
				role="tooltip">{s.rule}</span
			></span
		>{:else}{#each heads(s.text, i === 0) as p, j (j)}{#if p.head}<b class="rule-name">{p.text}</b>{:else}{p.text}{/if}{/each}{/if}{/each}

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
		text-decoration-color: var(--edge, currentColor);
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
	/* On the warband pages (Trench Companion's dark register), a keyword in the text is underlined in its kind's colour. */
	:global(.tc) .kw button {
		font-weight: 600;
		text-decoration-style: solid;
		text-decoration-thickness: 2px;
	}
	:global(.tc) .look-bonus {
		--edge: #8fb04a;
	}
	:global(.tc) .look-attack {
		--edge: #6aa2d6;
	}
	:global(.tc) .look-kit {
		--edge: #b583d4;
	}
	:global(.tc) .look-harm {
		--edge: #e0574b;
	}
	:global(.tc) .look-body {
		--edge: #e0a23a;
	}
	:global(.tc) .look-ground {
		--edge: #55aab4;
	}
	:global(.tc) .rule-name {
		color: var(--blood-pale, #d98c80);
	}
	.kw:hover .tip,
	.kw:focus-within .tip,
	.tip.shown {
		display: block;
	}
</style>
