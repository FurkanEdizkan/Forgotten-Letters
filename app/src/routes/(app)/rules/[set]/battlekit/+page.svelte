<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/messages';
	import { ITEM_CATEGORIES } from '#lib/rules/pack';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import ItemCard from '#lib/ui/rules/ItemCard.svelte';
	import RuleText from '#lib/ui/rules/RuleText.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let q = $state('');
	// Follows the section tree's category links; the select overrides it until the next link.
	let category = $derived(page.url.searchParams.get('category') ?? '');
	let keyword = $state('');

	const categories = [
		{ value: '', label: m.rules.allCategories },
		...ITEM_CATEGORIES.map((c) => ({ value: c, label: m.rules.categories[c]! }))
	];
	const keywords = $derived([
		{ value: '', label: m.rules.allKeywords },
		...[...new Set(data.items.flatMap((i) => i.item.keywords.map((k) => k.kw)))]
			.map((kw) => ({ value: kw, label: data.keywords[kw]?.name ?? kw }))
			.sort((a, b) => a.label.localeCompare(b.label))
	]);
	const shown = $derived(
		data.items.filter(
			({ item }) =>
				(!category || item.category === category) &&
				(!keyword || item.keywords.some((k) => k.kw === keyword)) &&
				(!q || item.name.toLowerCase().includes(q.trim().toLowerCase()))
		)
	);
</script>

<svelte:head
	><title>{m.rules.sections.battlekit} · {m.rules.title} · {m.app.name}</title></svelte:head
>

<h1>{m.rules.sections.battlekit}</h1>
{#each data.pages as p (p.id)}<RuleText body={p.body} />{/each}
<div class="filters">
	<Field label={m.rules.filter} name="filter" type="search" bind:value={q} autocomplete="off" />
	<Select label={m.rules.category} name="category" options={categories} bind:value={category} />
	<Select label={m.rules.keyword} name="keyword" options={keywords} bind:value={keyword} />
</div>
{#if shown.length}
	<div class="grid">
		{#each shown as k (k.item.id)}<ItemCard item={k.item} takenBy={k.takenBy} />{/each}
	</div>
{:else}
	<EmptyState text={m.rules.noItems} />
{/if}

<style>
	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-3);
		align-items: end;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
		gap: var(--space-3);
	}
</style>
