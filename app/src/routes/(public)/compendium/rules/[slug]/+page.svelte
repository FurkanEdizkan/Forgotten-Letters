<script lang="ts">
	import { blocks, segments } from '$lib/rules-text';

	let { data } = $props();
	const BOOKS = { core: 'Core Rules', campaign: 'Campaign', scenario: 'Scenarios' } as const;
	const body = $derived(blocks(data.page.body));
	const chapters = $derived(
		data.index.reduce<{ chapter: string; pages: typeof data.index }[]>((acc, p) => {
			if (acc.at(-1)?.chapter !== p.chapter) acc.push({ chapter: p.chapter, pages: [] });
			acc.at(-1)!.pages.push(p);
			return acc;
		}, [])
	);
</script>

<svelte:head><title>{data.page.title} · Compendium</title></svelte:head>

{#snippet rich(text: string)}
	{#each segments(text, data.glossary) as s, i (i)}
		{#if s.keyword}<a class="kw" href="/compendium/keywords#{s.keyword}" title={s.rule}>{s.text}</a>{:else}{s.text}{/if}
	{/each}
{/snippet}

<main>
	<nav class="crumbs" aria-label="Breadcrumb">
		<a href="/compendium">Compendium</a> / {BOOKS[data.page.book]} / {data.page.chapter}
	</nav>
	<div class="layout">
		<article>
			<h1>{data.page.title}</h1>
			<p class="source">{data.page.source ?? ''}{data.page.page ? `, p. ${data.page.page}` : ''}</p>
			{#each body as b, i (i)}
				{#if b.kind === 'heading'}
					<h2>{b.text}</h2>
				{:else if b.kind === 'bullet'}
					<p class="bullet">{@render rich(b.text)}</p>
				{:else if b.kind === 'table'}
					<div class="table">
						<table>
							<tbody>
								{#each b.rows as row, r (r)}
									<tr>{#each row as cell, c (c)}<td>{@render rich(cell)}</td>{/each}</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p>{@render rich(b.text)}</p>
				{/if}
			{/each}
			<nav class="pager" aria-label="Pages">
				{#if data.prev}<a href="/compendium/rules/{data.prev.slug}">← {data.prev.title}</a>{:else}<span></span>{/if}
				{#if data.next}<a href="/compendium/rules/{data.next.slug}">{data.next.title} →</a>{/if}
			</nav>
		</article>
		<aside aria-label={BOOKS[data.page.book]}>
			<h2>{BOOKS[data.page.book]}</h2>
			{#each chapters as ch (ch.chapter)}
				<h3>{ch.chapter}</h3>
				<ul>
					{#each ch.pages as p (p.slug)}
						<li><a href="/compendium/rules/{p.slug}" aria-current={p.slug === data.page.slug ? 'page' : undefined}>{p.title}</a></li>
					{/each}
				</ul>
			{/each}
		</aside>
	</div>
</main>

<style>
	main {
		max-width: 72rem;
		margin: 0 auto;
		padding: 24px clamp(16px, 4vw, 40px) 0;
	}
	.crumbs {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.crumbs a {
		color: inherit;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 16rem;
		gap: 40px;
		align-items: start;
	}
	article {
		max-width: 68ch;
	}
	.source {
		color: var(--muted);
		font-style: italic;
		margin-top: -6px;
	}
	article h2 {
		font-size: 1.15rem;
		margin: 1.4em 0 0.3em;
		color: var(--blood);
	}
	.bullet {
		padding-left: 1.1em;
		text-indent: -1.1em;
	}
	.bullet::before {
		content: '✠ ';
		color: var(--blood);
	}
	.kw {
		color: inherit;
		font-weight: 600;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}
	.table {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		margin: 0.6em 0 1em;
		font-size: 0.95rem;
	}
	td {
		border-bottom: 1px solid var(--rule);
		padding: 5px 12px 5px 0;
		vertical-align: top;
	}
	tr:first-child td {
		border-top: 2px solid var(--ink);
		font-weight: 600;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		margin: 32px 0 8px;
		padding-top: 12px;
		border-top: 2px solid var(--ink);
	}
	aside {
		position: sticky;
		top: 16px;
		max-height: calc(100dvh - 32px);
		overflow-y: auto;
		border-top: 2px solid var(--ink);
		font-size: 0.92rem;
	}
	aside h2 {
		font-size: 1.1rem;
		margin: 8px 0 4px;
	}
	aside h3 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 12px 0 2px;
	}
	aside ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	aside a {
		display: block;
		padding: 2px 0;
		color: var(--ink);
		text-decoration: none;
	}
	aside a[aria-current='page'] {
		color: var(--blood);
		font-weight: 600;
	}
	@media (max-width: 760px) {
		.layout {
			grid-template-columns: 1fr;
		}
		aside {
			position: static;
			max-height: none;
		}
	}
</style>
