<script lang="ts">
	/**
	 * The Rules Editor's library: the edition's keywords, kit, units and ready rules. Drag one onto a list or a
	 * rule, or click it to add it to the list focused last.
	 */
	import { describeLimit, type Limit } from '$lib/warband-limits';
	import { endDrag, startDrag, target, type Kind } from './drag.svelte';

	type Entry = { name: string; note?: string; title?: string; missing?: boolean; value?: unknown };
	let {
		keywords,
		items,
		units,
		limits
	}: { keywords: Entry[]; items: Entry[]; units: Entry[]; limits: { from: string; label?: string; limit: Limit }[] } = $props();

	const TABS = { keyword: 'Keywords', item: 'Kit', unit: 'Units', limit: 'Rules' } as const;
	let tab = $state<keyof typeof TABS>('keyword');
	let q = $state('');
	const hit = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
	const shown = $derived(
		tab === 'limit'
			? limits.map((l) => ({ name: l.label ?? describeLimit(l.limit), note: l.from, value: l.limit as unknown })).filter((e) => hit(e.name + e.note))
			: (tab === 'keyword' ? keywords : tab === 'item' ? items : units).filter((e) => hit(e.name + (e.note ?? ''))).map((e) => ({ ...e, value: e.value ?? (e.name as unknown) }))
	);
	// Follow the list being edited: a keyword list shows keywords, a rule list shows rules.
	$effect(() => {
		const k = target.kind;
		if (k && k in TABS) tab = k as keyof typeof TABS;
	});
	const fits = $derived(target.kind === tab);
	function pick(v: unknown) {
		if (fits) target.add?.(v);
	}
</script>

<aside class="library" aria-label="Library">
	<div class="tabs" role="tablist">
		{#each Object.entries(TABS) as [k, l] (k)}
			<button type="button" role="tab" aria-selected={tab === k} class="ghost" onclick={() => ((tab = k as keyof typeof TABS), (q = ''))}>{l}</button>
		{/each}
	</div>
	<input type="search" bind:value={q} placeholder="Search {TABS[tab].toLowerCase()}…" aria-label="Search the library" />
	<p class="hint">
		{#if fits}Click adds to <b>{target.label}</b>; or drag.{:else}Drag onto a list, or focus a {TABS[tab].toLowerCase()} list and click.{/if}
	</p>
	<ul>
		{#each shown.slice(0, 300) as e, i (i + e.name)}
			<li>
				<button
					type="button"
					class="entry"
					class:missing={'missing' in e && e.missing}
					draggable="true"
					title={'title' in e ? e.title : undefined}
					ondragstart={(ev) => startDrag(ev, tab as Kind, e.value)}
					ondragend={endDrag}
					onclick={() => pick(e.value)}
				>
					<span class="name">{e.name}</span>{#if e.note}<span class="note">{e.note}</span>{/if}
				</button>
			</li>
		{:else}
			<li class="none">Nothing matches.</li>
		{/each}
	</ul>
</aside>

<style>
	.library {
		display: grid;
		grid-template-rows: auto auto auto 1fr;
		gap: 6px;
		min-height: 0;
	}
	.tabs {
		display: flex;
		border-bottom: 2px solid var(--ink);
	}
	.tabs button {
		flex: 1;
		padding: 5px 4px;
		border: 0;
		border-bottom: 3px solid transparent;
		margin-bottom: -2px;
		font-size: 0.78rem;
	}
	.tabs button[aria-selected='true'] {
		color: var(--blood);
		border-bottom-color: var(--blood);
	}
	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: auto;
		border-top: 1px solid var(--rule);
	}
	.entry {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0 8px;
		width: 100%;
		padding: 4px 4px;
		border: 0;
		border-bottom: 1px solid var(--rule);
		background: transparent;
		color: var(--ink);
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		font-size: 0.88rem;
		cursor: grab;
	}
	.entry:hover {
		background: var(--parchment);
		color: var(--blood);
	}
	.entry.missing .name::after {
		content: ' · no text';
		color: var(--blood);
		font-size: 0.75rem;
	}
	.note {
		color: var(--muted);
		font-size: 0.78rem;
	}
	.none {
		padding: 6px 4px;
		color: var(--muted);
	}
</style>
