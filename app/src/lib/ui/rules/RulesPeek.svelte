<!--
  The one rules card a page shows over itself (2026-11-03, instead of a trip to the docs): an item, unit, keyword or
  any other element, drawn by the compendium's own cards. Opened by `use:peek` links (lib/ui/rules/peek.svelte.ts):
  resting on a link shows it, a click keeps it open until Esc, × or a click elsewhere. A top-layer popover, so it
  shows over the builder's modal dialogs too. Data comes from the rules node API, once per element; keywords need
  none. "Read in the docs" opens the full page in a new tab.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { m } from '#lib/messages';
	import { typeOf, type Item, type Unit } from '#lib/rules/pack';
	import { elementHref } from '#lib/rules/text';
	import type { NodeOut } from '#lib/schemas/rules';
	import ItemCard from './ItemCard.svelte';
	import RuleText from './RuleText.svelte';
	import UnitCard from './UnitCard.svelte';
	import { rulesView } from './context';
	import { closeSoon, hidePeek, peekState, place, stayOpen } from './peek.svelte';

	const view = rulesView();
	const t = m.rules.peek;
	let el = $state<HTMLElement>();
	let home = $state<HTMLElement>();
	let pos = $state({ x: 0, y: 0 });
	// A plain cache of loads: nothing renders from it, so it need not be reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const cache = new Map<string, Promise<NodeOut>>();

	onMount(() => {
		peekState.host = true;
		// The card grows once its data arrives: place it again so it stays inside the window.
		const sized = new ResizeObserver(() => void position());
		if (el) sized.observe(el);
		return () => {
			sized.disconnect();
			peekState.host = false;
			hidePeek();
		};
	});

	function load(id: string): Promise<NodeOut> {
		const key = `${view.set}|${id}`;
		let p = cache.get(key);
		if (!p) {
			const q = new URLSearchParams({ set: view.set, id, depth: '1' });
			p = fetch(`/api/v1/rules/node?${q}`).then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				return r.json() as Promise<NodeOut>;
			});
			// A failed load may work next time.
			p.catch(() => cache.delete(key));
			cache.set(key, p);
		}
		return p;
	}

	const id = $derived(peekState.id);
	const kw = $derived(id && typeOf(id) === 'kw' ? view.keywords[id] : undefined);
	const name = $derived(id ? (kw?.name ?? view.names[id]?.name ?? id) : '');
	const node = $derived(id && !kw ? load(id) : null);

	async function position() {
		const a = peekState.anchor;
		if (!el || !a) return;
		await tick();
		const r = a.getBoundingClientRect();
		pos = place(r, el.getBoundingClientRect(), {
			width: window.innerWidth,
			height: window.innerHeight
		});
	}

	// Shown again on every opening, so it rises above a dialog opened since.
	$effect(() => {
		const open = !!peekState.id;
		const pinned = peekState.pinned;
		void peekState.anchor;
		if (!el || !home) return;
		if (el.matches(':popover-open')) el.hidePopover();
		// A modal dialog makes everything outside it inert, so a link inside one gets its card inside it too.
		const parent = (open && peekState.anchor?.closest('dialog[open]')) || home;
		if (el.parentElement !== parent) parent.append(el);
		if (!open) return;
		el.showPopover();
		void position();
		if (pinned) el.querySelector<HTMLElement>('.x')?.focus();
	});

	function close() {
		const back = peekState.pinned ? peekState.anchor : null;
		hidePeek();
		back?.focus();
	}
</script>

<svelte:window
	onkeydowncapture={(e) => {
		if (!peekState.id || e.key !== 'Escape') return;
		// One Esc closes the card only, not the dialog under it as well.
		e.preventDefault();
		e.stopPropagation();
		close();
	}}
	onpointerdowncapture={(e) => {
		const at = e.target as Node;
		if (!peekState.pinned || el?.contains(at) || peekState.anchor?.contains(at)) return;
		hidePeek();
	}}
	onresize={() => position()}
/>

<div bind:this={home} class="home">
	<div
		bind:this={el}
		popover="manual"
		class="peek"
		role="dialog"
		tabindex="-1"
		aria-label={name}
		data-peek={id ?? undefined}
		style:left="{pos.x}px"
		style:top="{pos.y}px"
		onmouseenter={stayOpen}
		onmouseleave={closeSoon}
	>
		{#if id}
			<div class="bar">
				<button type="button" class="x" aria-label={t.close} title={t.close} onclick={close}
					>×</button
				>
			</div>
			{#if kw}
				<article class="plain">
					<h3>{kw.name}</h3>
					<RuleText body={kw.text} />
				</article>
			{:else if node}
				{#await node}
					<p class="dim">{t.loading}</p>
				{:then n}
					{#if n.node.type === 'item'}
						<ItemCard item={n.node.data as unknown as Item} takenBy={[]} compact />
					{:else if n.node.type === 'unit'}
						<UnitCard unit={n.node.data as unknown as Unit} compact />
					{:else}
						<article class="plain">
							<h3>{n.node.name}</h3>
							<RuleText body={typeof n.node.data.text === 'string' ? n.node.data.text : ''} />
						</article>
					{/if}
				{:catch}
					<p role="alert">{t.failed}</p>
				{/await}
			{/if}
			<a class="docs" href={elementHref(view.set, id)} target="_blank" rel="noopener"
				>{t.readInDocs}</a
			>
		{/if}
	</div>
</div>

<style>
	.home {
		display: contents;
	}
	.peek {
		position: fixed;
		inset: auto;
		margin: 0;
		width: min(26rem, calc(100vw - 16px));
		max-height: calc(100vh - 16px);
		overflow-y: auto;
		padding: 0 0 var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule-strong);
		box-shadow: var(--shadow-overlay);
		color: var(--bone);
	}
	.bar {
		position: sticky;
		top: 0;
		display: flex;
		justify-content: flex-end;
		height: 0;
		z-index: 1;
	}
	.x {
		width: 2rem;
		height: 2rem;
		background: none;
		border: 0;
		color: var(--bone-dim);
		font-size: 1.25rem;
		cursor: pointer;
	}
	.x:hover {
		color: var(--bone);
	}
	.plain {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4) 0;
		border-top: var(--border-card-top) solid var(--blood);
	}
	h3 {
		margin: 0;
		padding-right: var(--space-5);
		color: var(--blood-pale);
		font-size: var(--size-h3, 1.1rem);
	}
	.dim,
	[role='alert'] {
		margin: 0;
		padding: var(--space-4) var(--space-4) 0;
		color: var(--bone-dim);
	}
	.docs {
		display: block;
		margin: var(--space-2) var(--space-4) 0;
		text-align: right;
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.docs:hover {
		color: var(--bone);
	}
	/* The compendium cards bring their own panel; inside the card it is the card itself. */
	.peek :global(article.card) {
		border-left: 0;
		border-right: 0;
		border-bottom: 0;
	}
</style>
