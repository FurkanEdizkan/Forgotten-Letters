<script lang="ts">
	import Seal from '$lib/components/Seal.svelte';
	import { page } from '$app/state';

	let { data } = $props();
	const name = (id: string) => data.factions.find((f) => f.id === id)?.name ?? id;
	const BOOKS = [
		['core', 'Core Rules'],
		['campaign', 'Campaign'],
		['scenario', 'Scenarios']
	] as const;
	/** A book's pages grouped under their chapters. */
	const chaptersOf = (book: string) =>
		data.pages
			.filter((p) => p.book === book)
			.reduce<{ chapter: string; pages: typeof data.pages }[]>((acc, p) => {
				if (acc.at(-1)?.chapter !== p.chapter) acc.push({ chapter: p.chapter, pages: [] });
				acc.at(-1)!.pages.push(p);
				return acc;
			}, []);
</script>

<svelte:head><title>Compendium · {page.data.snapshot?.campaign.name ?? 'Carcass Front'}</title></svelte:head>

<main>
	<h1>Compendium</h1>
	<p class="lede">The rules, the warbands, their battlekit and the keywords, from the rulebooks this campaign uses.</p>
	<form class="search" role="search">
		<input name="q" value={data.q} placeholder="Search rules, units, battlekit and keywords" aria-label="Search the compendium" />
		<button>Search</button>
	</form>

	{#if data.results}
		<section class="results">
			<h2>Found</h2>
			{#if !data.results.units.length && !data.results.items.length && !data.results.keywords.length && !data.results.pages.length}
				<p class="muted"><em>Nothing matches “{data.q}”.</em></p>
			{/if}
			{#if data.results.pages.length}
				<h3>Rules</h3>
				<ul>
					{#each data.results.pages as p (p.slug)}
						<li><a href="/compendium/rules/{p.slug}">{p.title}</a> <small>{p.chapter}</small><br /><small class="snip">{p.snippet}</small></li>
					{/each}
				</ul>
			{/if}
			{#if data.results.units.length}
				<h3>Units</h3>
				<ul>
					{#each data.results.units as u (u.id)}
						<li><a href="/compendium/{u.faction}#{u.id}">{u.name}</a> <small>{name(u.faction)}{u.variant ? ` · ${u.variant}` : ''} · {u.cost} {u.currency}</small></li>
					{/each}
				</ul>
			{/if}
			{#if data.results.items.length}
				<h3>Battlekit</h3>
				<ul>
					{#each data.results.items as i (i.id)}
						<li><a href="/compendium/{i.faction}#kit-{i.id}">{i.name}</a> <small>{name(i.faction)} · {i.cost} {i.currency}</small></li>
					{/each}
				</ul>
			{/if}
			{#if data.results.keywords.length}
				<h3>Keywords</h3>
				{#each data.results.keywords as k (k.name)}
					<p><strong>{k.name}</strong>{k.kind ? ` (${k.kind})` : ''}: {k.text}</p>
				{/each}
			{/if}
		</section>
	{/if}

	{#if data.pages.length}
		<div class="books">
			{#each BOOKS as [book, title] (book)}
				{@const chapters = chaptersOf(book)}
				{#if chapters.length}
					<section>
						<h2>{title}</h2>
						{#each chapters as ch (ch.chapter)}
							<details open={chapters.length === 1}>
								<summary>{ch.chapter} <small>{ch.pages.length}</small></summary>
								<ul>
									{#each ch.pages as p (p.slug)}<li><a href="/compendium/rules/{p.slug}">{p.title}</a></li>{/each}
								</ul>
							</details>
						{/each}
					</section>
				{/if}
			{/each}
		</div>
	{/if}

	{#if data.factions.length}
		<h2>Warbands</h2>
		<ul class="factions">
			{#each data.factions as f (f.id)}
				<li>
					<a href="/compendium/{f.id}">
						<Seal faction={f.id} size={56} />
						<span><strong>{f.name}</strong><small>{f.units} units · {f.alignment === 'any' ? 'Faithful and Fallen' : f.alignment === 'faithful' ? 'Faithful' : 'Fallen'}</small></span>
					</a>
				</li>
			{/each}
		</ul>
		<h2>Keywords</h2>
		<p><a href="/compendium/keywords">The keywords glossary</a> <small class="muted">({data.keywordCount} keywords)</small></p>
	{:else}
		<p class="muted rules-box">
			No rules have been loaded yet. The Campaign Master imports them from the group's own rulebooks (Admin → Rules).
		</p>
	{/if}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.lede {
		color: var(--ink-soft);
		margin: 0 0 14px;
	}
	.search {
		display: flex;
		gap: 8px;
		max-width: 36rem;
	}
	.search input {
		flex: 1;
	}
	.results ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.results li {
		padding: 4px 0;
		border-bottom: 1px solid var(--rule);
	}
	small,
	.muted {
		color: var(--muted);
	}
	.snip {
		font-style: italic;
	}
	.books {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0 28px;
		margin-top: 8px;
	}
	.books h2 {
		border-bottom: 2px solid var(--ink);
		padding-bottom: 4px;
	}
	.books summary {
		cursor: pointer;
		padding: 5px 0;
		font-weight: 600;
		border-bottom: 1px solid var(--rule);
	}
	.books ul {
		list-style: none;
		margin: 4px 0 8px;
		padding: 0 0 0 12px;
	}
	.books li a {
		display: block;
		padding: 2px 0;
		color: var(--ink);
		text-decoration: none;
	}
	.books li a:hover {
		color: var(--blood);
	}
	.factions {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0 28px;
		border-top: 2px solid var(--ink);
	}
	.factions a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 2px;
		border-bottom: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	.factions a:hover strong {
		color: var(--blood);
	}
	.factions span {
		display: grid;
		line-height: 1.3;
	}
	.factions strong {
		font-size: 1.05rem;
	}
</style>
