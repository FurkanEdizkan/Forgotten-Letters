<script lang="ts">
	import { m } from '#lib/messages';
	import { warbandHref } from '#lib/rules/text';
	import { elementHref } from '#lib/rules/text';
	import type { LinkOut } from '#lib/schemas/rules';
	import DataView from '#lib/ui/rules/DataView.svelte';
	import Graph from '#lib/ui/rules/Graph.svelte';
	import KeywordChip from '#lib/ui/rules/KeywordChip.svelte';
	import RuleText from '#lib/ui/rules/RuleText.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const n = $derived(data.node.node);
	const here = $derived(elementHref(data.set, n.id));
	/** Links grouped by kind, in the order the service sorted them. */
	const byKind = (links: LinkOut[]) =>
		Object.entries(Object.groupBy(links, (l) => l.kind)) as [string, LinkOut[]][];
	const kws = $derived(
		(Array.isArray(n.data.keywords) ? n.data.keywords : []) as {
			kw: string;
			value?: string | number;
		}[]
	);
</script>

<svelte:head><title>{n.name} · {m.rules.title} · {m.app.name}</title></svelte:head>

<header>
	<h1>{n.name}</h1>
	<p class="dim">
		{m.rules.types[n.type] ?? n.type} · <span class="mono">{n.id}</span>
		{#if n.setId !== data.set}· {n.setId}{/if}
		{#if n.type === 'faction' || n.type === 'variant'}
			· <a href={warbandHref(data.set, n.id)}>{m.rules.sections.warbands}</a>
		{/if}
	</p>
</header>

{#if kws.length && typeof kws[0] === 'object'}
	<div class="chips">
		{#each kws as k, i (`${i}:${k.kw}`)}<KeywordChip id={k.kw} value={k.value} />{/each}
	</div>
{/if}
{#if typeof n.data.text === 'string'}<RuleText body={n.data.text} />{/if}
{#if typeof n.data.body === 'string'}<RuleText body={n.data.body} />{/if}

<div class="columns">
	<section aria-labelledby="links-out">
		<h2 id="links-out">{m.rules.linksOut}</h2>
		{@render links(data.node.out)}
	</section>
	<section aria-labelledby="links-in">
		<h2 id="links-in">{m.rules.linksIn}</h2>
		{@render links(data.node.in)}
	</section>
</div>

{#snippet links(list: LinkOut[])}
	{#if list.length}
		<dl class="links">
			{#each byKind(list) as [kind, ls] (kind)}
				<div>
					<dt>{m.rules.edges[kind] ?? kind}</dt>
					<dd>
						{#each ls as l, i (l.id)}{i ? ', ' : ''}<a href={elementHref(data.set, l.id)}
								>{l.name}</a
							>{/each}
					</dd>
				</div>
			{/each}
		</dl>
	{:else}
		<p class="dim">{m.rules.noLinks}</p>
	{/if}
{/snippet}

<section class="graph" aria-labelledby="graph-h">
	<div class="graph-head">
		<h2 id="graph-h">{m.rules.graph}</h2>
		<nav aria-label={m.rules.depth}>
			<a href="{here}?depth=1" aria-current={data.depth === 1 ? 'page' : undefined}
				>{m.rules.depthOne}</a
			>
			<a href="{here}?depth=2" aria-current={data.depth === 2 ? 'page' : undefined}
				>{m.rules.depthTwo}</a
			>
		</nav>
	</div>
	<p class="dim">{m.rules.graphHint}</p>
	<Graph set={data.set} graph={data.node.graph} />
</section>

<section aria-labelledby="data-h">
	<h2 id="data-h">{m.rules.data}</h2>
	<DataView data={n.data} />
</section>

<style>
	header {
		display: grid;
		gap: var(--space-1);
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	section {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: var(--space-5);
	}
	.links {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		border-top: var(--border-opening) solid var(--rule-strong);
	}
	.links div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: var(--space-3);
		padding: var(--space-1) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	dt {
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	dd {
		margin: 0;
	}
	a {
		color: var(--blood-pale);
	}
	.graph-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-3);
	}
	.graph-head nav {
		display: flex;
		gap: var(--space-1);
	}
	.graph-head nav a {
		padding: var(--space-1) var(--space-3);
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone);
		text-decoration: none;
	}
	.graph-head nav a[aria-current='page'] {
		border-color: var(--blood-bright);
	}
</style>
