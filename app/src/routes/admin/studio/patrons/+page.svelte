<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import PatronForm from './PatronForm.svelte';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const ORIGIN: Record<string, string> = { custom: 'yours', edited: 'house rule', book: '' };
	const blank = { id: '', name: '', alignment: null, factions: [], variants: [], text: '', skills: [], source: null };
	let filter = $state('');
	const sel = $derived(data.entry === 'new' ? null : (data.patrons.find((p) => p.id === data.entry) ?? data.patrons[0] ?? null));
	const shown = $derived(data.patrons.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase())));
	const errors = $derived(form && 'errors' in form && form.at === (sel?.id || 'new') ? (form.errors ?? null) : null);
	// A new Patron, once saved, becomes the one open.
	$effect(() => {
		if (data.entry === 'new' && form && 'saved' in form && data.patrons.some((p) => p.id === form.saved)) goto(`?entry=${encodeURIComponent(String(form.saved))}`, { replaceState: true, noScroll: true });
	});
</script>

<svelte:head><title>Patrons · Faction Studio</title></svelte:head>

<datalist id="dl-keyword">{#each data.keywordNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-unit">{#each data.unitNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-item">{#each data.itemNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-skill">{#each data.skillNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-upgrade"></datalist>
<datalist id="dl-faction">{#each data.factions as f (f.id)}<option value={f.id}>{f.name}</option>{/each}</datalist>
<datalist id="dl-variant">{#each data.factions.flatMap((f) => f.variants) as v (v)}<option value={v}></option>{/each}</datalist>

<p class="crumb"><a href="/admin/studio">Faction Studio</a> · edition <a href="/admin/studio/editions">{data.edition}</a></p>
<h1>Patrons</h1>

<div class="workbench">
	<nav class="entries" aria-label="Patrons">
		<input type="search" bind:value={filter} placeholder="Find a Patron…" aria-label="Find a Patron" />
		<ul>
			{#each shown as p (p.id)}
				<li class:on={sel?.id === p.id}>
					<a href="?entry={encodeURIComponent(p.id)}" aria-current={sel?.id === p.id ? 'true' : undefined} data-sveltekit-noscroll>{p.name}</a>
					<span class="meta">{p.skills.length} Skills{p.alignment ? ` · ${p.alignment}` : ''}</span>
					{#if ORIGIN[p.origin]}<span class="tick">{ORIGIN[p.origin]}</span>{/if}
				</li>
			{:else}<li class="meta">No Patrons in this edition yet.</li>{/each}
		</ul>
		<a class="add" href="?entry=new" aria-current={!sel ? 'true' : undefined} data-sveltekit-noscroll>+ New Patron</a>
	</nav>
	<section class="pane" aria-label={sel?.name ?? 'New Patron'}>
		{#key sel?.id ?? 'new'}
			<PatronForm p={sel ?? blank} {errors} saved={!!(form && 'saved' in form && form.saved === sel?.id)} />
		{/key}
		{#if sel?.revertible}
			<form method="POST" action="?/revert" use:enhance={keep}><input type="hidden" name="id" value={sel.id} /><button class="ghost">Revert to book</button></form>
		{:else if sel?.origin === 'custom'}
			<details class="confirm">
				<summary>Remove…</summary>
				<form method="POST" action="?/remove" use:enhance={keep}><input type="hidden" name="id" value={sel.id} /><button class="danger">Remove {sel.name}</button></form>
			</details>
		{/if}
	</section>
</div>

<style>
	.crumb {
		margin: 0;
		font-size: 0.9rem;
	}
	.crumb a {
		color: var(--muted);
	}
	.workbench {
		display: grid;
		grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}
	.entries {
		position: sticky;
		top: 8px;
		display: grid;
		gap: 6px;
		max-height: calc(100dvh - 16px);
		overflow: auto;
		border-top: 2px solid var(--ink);
		padding-top: 6px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 8px;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
		font-size: 0.92rem;
	}
	li a {
		color: var(--ink);
		text-decoration: none;
		font-weight: 600;
	}
	li a:hover,
	li.on a {
		color: var(--blood);
	}
	li.on {
		box-shadow: inset 2px 0 0 var(--blood);
		padding-left: 6px;
	}
	.meta {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.tick {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--supplies);
	}
	.add {
		padding: 6px 0;
		font-weight: 600;
		text-decoration: none;
	}
	.add[aria-current='true'] {
		color: var(--blood);
	}
	.pane {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	.confirm summary {
		cursor: pointer;
		color: var(--blood);
	}
	.danger {
		background: var(--blood);
		border-color: var(--blood);
	}
	@media (max-width: 48rem) {
		.workbench {
			grid-template-columns: minmax(0, 1fr);
		}
		.entries {
			position: static;
			max-height: 15rem;
		}
	}
</style>
