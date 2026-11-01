<!--
  Any element's data as nested lists of fields: ids become links to their pages, text fields render as rules text.
  The generic element page uses it, so a type without its own view still reads plainly.
-->
<script lang="ts">
	import { isId } from '#lib/rules/edges';
	import { elementHref } from '#lib/rules/text';
	import RuleText from './RuleText.svelte';
	import { rulesView } from './context';

	type Props = { data: Record<string, unknown> };
	let { data }: Props = $props();
	const view = rulesView();
	const TEXT = new Set(['text', 'lore', 'body', 'notes', 'deployment', 'victory']);
	/** Field names as words: startDucats → start ducats. */
	const words = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
	const hidden = new Set(['id']);
</script>

{#snippet value(v: unknown, key: string)}
	{#if typeof v === 'string' && isId(v)}
		<a href={elementHref(view.set, v)}>{view.names[v]?.name ?? v}</a>
	{:else if typeof v === 'string' && TEXT.has(key)}
		<RuleText body={v} />
	{:else if Array.isArray(v)}
		{#if v.length}
			<ul>
				{#each v as x, i (i)}<li>{@render value(x, key)}</li>{/each}
			</ul>
		{:else}<span class="dim">—</span>{/if}
	{:else if v && typeof v === 'object'}
		{@render fields(v as Record<string, unknown>)}
	{:else}
		<span class="data">{String(v)}</span>
	{/if}
{/snippet}

{#snippet fields(o: Record<string, unknown>)}
	<dl>
		{#each Object.entries(o).filter(([k]) => !hidden.has(k)) as [k, v] (k)}
			<div>
				<dt>{isId(k) ? (view.names[k]?.name ?? k) : words(k)}</dt>
				<dd>{@render value(v, k)}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<div class="data-view">{@render fields(data)}</div>

<style>
	.data-view :global(dl) {
		display: grid;
		gap: var(--space-1);
		margin: 0;
	}
	.data-view :global(dl > div) {
		display: grid;
		grid-template-columns: minmax(8rem, 12rem) 1fr;
		gap: var(--space-3);
		padding: var(--space-1) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.data-view :global(dl dl > div:last-child) {
		border-bottom: 0;
	}
	.data-view :global(dt) {
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.data-view :global(dd) {
		margin: 0;
		min-width: 0;
	}
	.data-view :global(ul) {
		margin: 0;
		padding-left: var(--space-4);
	}
	.data-view :global(a) {
		color: var(--blood-pale);
	}
</style>
