<script lang="ts">
	import { m } from '#lib/messages';
	import { elementHref } from '#lib/rules/text';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{m.rules.search} · {m.app.name}</title></svelte:head>

<h1>{data.q ? m.rules.searchHeading(data.q) : m.rules.search}</h1>
{#if !data.q}
	<p class="dim">{m.rules.searchHint}</p>
{:else if data.items.length}
	<table class="table">
		<tbody>
			{#each data.items as r (r.id)}
				<tr>
					<td><a href={elementHref(data.set, r.id)}>{r.name}</a></td>
					<td>{m.rules.types[r.type] ?? r.type}</td>
					<td class="mono dim">{r.id}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<EmptyState text={m.rules.searchEmpty} />
{/if}

<style>
	a {
		color: var(--blood-pale);
	}
</style>
