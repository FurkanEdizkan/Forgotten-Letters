<script lang="ts">
	import { keywordKey } from '$lib/keywords';
	let { data } = $props();
	let filter = $state('');
	const shown = $derived(data.keywords.filter((k) => !filter || (k.name + ' ' + k.text).toLowerCase().includes(filter.toLowerCase())));
</script>

<svelte:head><title>Keywords · Compendium</title></svelte:head>

<main>
	<nav class="crumbs" aria-label="Breadcrumb"><a href="/compendium">Compendium</a> / Keywords</nav>
	<h1>Keywords</h1>
	<input class="filter" bind:value={filter} placeholder="Filter keywords" aria-label="Filter keywords" />
	<dl>
		{#each shown as k (k.name)}
			<dt id={keywordKey(k.name)}>{k.name}{#if k.kind}<small> ({k.kind})</small>{/if}</dt>
			<dd>{k.text}</dd>
		{/each}
	</dl>
</main>

<style>
	main {
		max-width: 52rem;
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
	.filter {
		width: min(24rem, 100%);
	}
	dl {
		margin: 16px 0 0;
		border-top: 2px solid var(--ink);
	}
	dt {
		margin-top: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	dt small {
		font-weight: 400;
		text-transform: none;
		color: var(--muted);
	}
	dd {
		margin: 2px 0 0;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--rule);
		max-width: 68ch;
		line-height: 1.55;
	}
</style>
