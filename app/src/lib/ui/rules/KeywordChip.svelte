<!--
  A keyword chip (DESIGN.md §7): square, panel-raised, a rule-coloured edge (the format's keywords carry no kind of
  the design's six), the name in Title Case and its value. It links to the keyword's page; hovering or focusing it
  shows the keyword's text in a pop-up, and Escape closes it. Links inside that text read as their names. A keyword
  a model has from something else (kit, a grant, a fireteam) is `from` that source: its edge is dashed and the pop-up
  says where it comes from. Where a page shows rules cards (the builder, play mode), the card replaces the pop-up and a
  click opens it instead of the keyword's page.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import { elementHref, inline } from '#lib/rules/text';
	import { rulesView } from './context';
	import { peek, peekState } from './peek.svelte';

	type Props = { id: string; value?: string | number; label?: string | null; from?: string };
	let { id, value, label = null, from }: Props = $props();

	const view = rulesView();
	const uid = $props.id();
	let open = $state(false);
	const kw = $derived(view.keywords[id]);
	const name = $derived(label ?? kw?.name ?? view.names[id]?.name ?? id);
	// A value may itself be a keyword (NEGATE FEAR): show its name, not its id.
	const shown = $derived(
		typeof value === 'string' && /^[a-z]+:/.test(value)
			? (view.keywords[value]?.name ?? view.names[value]?.name ?? value)
			: value
	);
	// With a value, the name's placeholder ("[KEYWORD]", "(X)") is what the value fills in.
	const bare = $derived(name.replace(/\s*[[(][^\])]*[\])]\s*/g, ' ').trim());
	const text = $derived(
		inline(kw?.text ?? '')
			.map((x) => (x.t === 'text' ? x.text : (x.label ?? view.names[x.id]?.name ?? x.id)))
			.join('')
	);
</script>

<!-- Escape closes a pop-up opened by hovering too, not only one opened by focus. -->
<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') open = false;
	}}
/>

<span
	class="kw"
	role="presentation"
	onmouseenter={() => (open = !peekState.host)}
	onmouseleave={() => (open = false)}
>
	<a
		class="chip"
		class:from={!!from}
		href={elementHref(view.set, id)}
		aria-describedby={text || from ? `${uid}-pop` : undefined}
		use:peek={id}
		onfocus={() => (open = !peekState.host)}
		onblur={() => (open = false)}>{shown !== undefined ? `${bare} ${shown}` : name}</a
	>
	{#if text || from}
		<span id="{uid}-pop" role="tooltip" class="pop" hidden={!open}>
			<strong>{kw?.name ?? name}</strong>
			{#if from}<em>{m.rules.keywordFrom(from)}</em>{/if}
			{text}
		</span>
	{/if}
</span>

<style>
	.kw {
		position: relative;
		display: inline-block;
	}
	.chip {
		display: inline-block;
		padding: 0 var(--space-2);
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule);
		border-left: var(--border-chip-edge) solid var(--rule-strong);
		color: var(--bone);
		text-decoration: none;
		line-height: 1.6;
		white-space: nowrap;
	}
	.chip:hover {
		border-color: var(--rule-strong);
	}
	.chip.from {
		border-style: dashed;
		color: var(--bone-dim);
	}
	.pop em {
		display: block;
		color: var(--bone-dim);
		font-style: normal;
		font-size: var(--size-label);
	}
	.pop {
		position: absolute;
		z-index: 20;
		left: 0;
		top: calc(100% + var(--space-1));
		width: max-content;
		max-width: 22rem;
		padding: var(--space-2) var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule-strong);
		box-shadow: var(--shadow-overlay);
		color: var(--bone);
		white-space: normal;
		font-size: var(--size-body);
		line-height: var(--line-body);
	}
	.pop[hidden] {
		display: none;
	}
	.pop strong {
		display: block;
		color: var(--blood-pale);
	}
</style>
