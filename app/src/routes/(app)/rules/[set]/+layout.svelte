<!--
  The compendium's frame, after Trench Companion's structure in our own look: a section tree on the left (Core Rules,
  Warbands, Comprehensive Rules, Battlekit with its categories, Campaigns, Scenarios, Errata & FAQ), the version
  switcher and search above it, the page on the right.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import { m } from '#lib/messages';
	import { ITEM_CATEGORIES } from '#lib/rules/pack';
	import { warbandHref } from '#lib/rules/text';
	import Select from '#lib/ui/Select.svelte';
	import Callout from '#lib/ui/Callout.svelte';
	import Time from '#lib/ui/Time.svelte';
	import { setRulesView } from '#lib/ui/rules/context';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	setRulesView({
		get set() {
			return data.set;
		},
		get names() {
			return data.names;
		},
		get keywords() {
			return data.keywords;
		}
	});

	const base = $derived(`/rules/${encodeURIComponent(data.set)}`);
	const path = $derived(page.url.pathname);
	const versions = $derived(
		data.sets.map((s) => ({
			value: s.id,
			label: `${m.rules.versionOf(s.name, s.version)}${s.base ? ` (${m.rules.onBase(s.base)})` : ''}`
		}))
	);
	const pagesOf = (section: string) => data.pages.filter((p) => p.section === section && !p.parent);
	const factions = $derived(
		Object.entries(data.names)
			.filter(([, n]) => n.type === 'faction')
			.map(([id, n]) => ({ id, name: n.name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const SECTIONS = [
		{ key: 'core-rules', href: 's/core-rules' },
		{ key: 'warbands', href: 'warbands' },
		{ key: 'comprehensive-rules', href: 's/comprehensive-rules' },
		{ key: 'battlekit', href: 'battlekit' },
		{ key: 'campaigns', href: 's/campaigns' },
		{ key: 'scenarios', href: 's/scenarios' },
		{ key: 'errata', href: 's/errata' }
	];
	const current = (href: string) =>
		path === href || path.startsWith(`${href}/`) ? 'page' : undefined;
	const category = $derived(page.url.searchParams.get('category'));

	/** The same page in another version (it may not exist there: then that version's 404). */
	function switchTo(set: string) {
		goto(path.replace(/^\/rules\/[^/]+/, `/rules/${encodeURIComponent(set)}`) + page.url.search);
	}
</script>

<div class="compendium">
	<aside>
		<Select
			label={m.rules.version}
			name="set"
			options={versions}
			value={data.set}
			onchange={(e) => switchTo((e.currentTarget as HTMLSelectElement).value)}
		/>
		<form method="GET" action="{base}/search" role="search" class="search">
			<label class="visually-hidden" for="rules-q">{m.rules.search}</label>
			<input
				id="rules-q"
				name="q"
				type="search"
				placeholder={m.rules.search}
				value={page.url.searchParams.get('q') ?? ''}
				maxlength="80"
			/>
			<button type="submit" aria-label={m.rules.searchButton} title={m.rules.searchButton}
				><Search size={18} strokeWidth={1.5} aria-hidden={true} /></button
			>
		</form>
		<nav aria-label={m.rules.sectionsNav}>
			<ul>
				{#each SECTIONS as s (s.key)}
					{@const href = `${base}/${s.href}`}
					<li>
						<a class="section" {href} aria-current={current(href)}>{m.rules.sections[s.key]}</a>
						{#if s.key === 'battlekit'}
							<ul>
								{#each ITEM_CATEGORIES as c (c)}
									<li>
										<a
											href="{href}?category={c}"
											aria-current={path === href && category === c ? 'page' : undefined}
											>{m.rules.categories[c]}</a
										>
									</li>
								{/each}
							</ul>
						{:else if s.key === 'warbands'}
							<ul>
								{#each factions as f (f.id)}
									{@const fh = warbandHref(data.set, f.id)}
									<li><a href={fh} aria-current={current(fh)}>{f.name}</a></li>
								{/each}
							</ul>
						{:else if pagesOf(s.key).length > 1}
							<ul>
								{#each pagesOf(s.key) as p (p.id)}
									<li><a href="{href}#{encodeURIComponent(p.id)}">{p.title}</a></li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>
	</aside>
	<div class="page">
		{#if data.draft}
			<Callout kind="warn">
				{m.homebrew.checks.serving}
				<Time at={data.draft.since} />.
				<details>
					<summary>{m.homebrew.editor.draftProblems} ({data.draft.problems.length})</summary>
					<ul>
						{#each data.draft.problems as p, i (i)}<li>
								{p.file}{p.id ? ` · ${p.id}` : ''}: {p.message}
							</li>{/each}
					</ul>
				</details>
			</Callout>
		{/if}
		{@render children()}
	</div>
</div>

<style>
	.compendium {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: var(--space-6);
		align-items: start;
	}
	aside {
		position: sticky;
		top: calc(var(--bar-height, 56px) + var(--space-4));
		display: grid;
		gap: var(--space-3);
		max-height: calc(100vh - var(--bar-height, 56px) - var(--space-6));
		overflow-y: auto;
		padding-right: var(--space-2);
	}
	.search {
		display: flex;
	}
	.search input {
		flex: 1;
		min-width: 0;
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-right: 0;
		color: var(--bone);
		font: inherit;
	}
	.search input:focus-visible {
		border-color: var(--blood-bright);
	}
	.search button {
		display: grid;
		place-items: center;
		width: var(--button-height);
		background: transparent;
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone);
		cursor: pointer;
	}
	.search button:hover {
		border-color: var(--blood-bright);
	}
	nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	nav > ul {
		border-top: var(--border-opening) solid var(--blood);
	}
	nav > ul > li {
		border-bottom: var(--border-hairline) solid var(--rule);
		padding: var(--space-1) 0;
	}
	nav a {
		display: block;
		padding: var(--space-1) var(--space-2);
		color: var(--bone-dim);
		text-decoration: none;
		border-left: 3px solid transparent;
	}
	nav a:hover {
		color: var(--bone);
		background: var(--panel-hover);
	}
	nav a[aria-current='page'] {
		color: var(--bone);
		border-left-color: var(--blood-bright);
	}
	.section {
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	nav ul ul a {
		padding-left: var(--space-5);
	}
	.page {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}
</style>
