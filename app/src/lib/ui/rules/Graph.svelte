<!--
  An element's neighbourhood (depth 1 or 2) laid out by d3-force and drawn as SVG: the element in the centre, its
  neighbours around it, nodes marked by type (a colour from the existing tokens plus the legend's word, so colour is
  never the only signal). Clicking a node opens its page. The SVG is a picture for pointer users; the list under it
  carries the same elements for the keyboard and screen readers.
-->
<script lang="ts">
	import { layout } from '#lib/rules/graph';
	import { elementHref } from '#lib/rules/text';
	import type { GraphOut } from '#lib/schemas/rules';
	import { m } from '#lib/messages';

	type Props = { set: string; graph: GraphOut };
	let { set, graph }: Props = $props();

	const W = 760;
	const H = 460;
	const at = $derived(new Map(layout(graph.nodes, graph.links, W, H).map((p) => [p.id, p])));
	const types = $derived([...new Set(graph.nodes.map((n) => n.type))].sort());
	const ring = (d: number) => graph.nodes.filter((n) => n.depth === d);
	const short = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);
</script>

<figure>
	<svg viewBox="0 0 {W} {H}" aria-hidden="true" data-testid="rules-graph">
		{#each graph.links as l (`${l.from} ${l.to} ${l.kind}`)}
			{@const a = at.get(l.from)}
			{@const b = at.get(l.to)}
			{#if a && b}<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />{/if}
		{/each}
		{#each graph.nodes as n (n.id)}
			{@const p = at.get(n.id)}
			{#if p}
				<a
					href={elementHref(set, n.id)}
					tabindex="-1"
					class="node t-{n.type}"
					class:self={n.depth === 0}
					data-id={n.id}
				>
					<title>{n.name}</title>
					<circle cx={p.x} cy={p.y} r={n.depth === 0 ? 11 : n.depth === 1 ? 8 : 6} />
					<!-- Second-step nodes stay unlabelled (name on hover and in the list below): dozens of labels at
					     depth 2 overlap into an unreadable knot. -->
					{#if n.depth < 2}<text x={p.x} y={p.y + (n.depth === 0 ? 26 : 21)}>{short(n.name)}</text
						>{/if}
				</a>
			{/if}
		{/each}
	</svg>
	<figcaption>
		<span class="label">{m.rules.legend}</span>
		{#each types as t (t)}<span class="key t-{t}"><i></i>{m.rules.types[t] ?? t}</span>{/each}
	</figcaption>
</figure>

<details class="list" open>
	<summary class="label">{m.rules.graphList}</summary>
	{#each [1, 2] as d (d)}
		{#if ring(d).length}
			<ul aria-label={d === 1 ? m.rules.depthOne : m.rules.depthTwo}>
				{#each ring(d) as n (n.id)}
					<li>
						<a href={elementHref(set, n.id)}>{n.name}</a>
						<span class="dim">{m.rules.types[n.type]}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</details>

<style>
	figure {
		margin: 0;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule);
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 30rem;
	}
	line {
		stroke: var(--rule-strong);
		stroke-width: 1;
	}
	.node circle {
		fill: var(--c);
		stroke: var(--night);
		stroke-width: 2;
	}
	.node.self circle {
		stroke: var(--bone);
	}
	.node text {
		fill: var(--bone-dim);
		font-family: var(--font-body);
		font-size: var(--size-label);
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--inset);
		stroke-width: 3px;
	}
	.node:hover text,
	.node.self text {
		fill: var(--bone);
	}
	.node:hover circle {
		stroke: var(--blood-bright);
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) var(--space-3);
		border-top: var(--border-hairline) solid var(--rule);
	}
	.key {
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
		color: var(--bone-dim);
	}
	.key i {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-disc);
		background: var(--c);
	}
	/* Type colours: the graph's own tokens (DESIGN.md §2, rules graph); the legend names each. */
	.t-faction {
		--c: var(--graph-faction);
	}
	.t-variant {
		--c: var(--graph-variant);
	}
	.t-unit {
		--c: var(--graph-unit);
	}
	.t-item {
		--c: var(--graph-item);
	}
	.t-line {
		--c: var(--graph-line);
	}
	.t-kw {
		--c: var(--graph-keyword);
	}
	.t-upgrade {
		--c: var(--graph-upgrade);
	}
	.t-patron {
		--c: var(--graph-patron);
	}
	.t-skill {
		--c: var(--graph-skill);
	}
	.t-table {
		--c: var(--graph-table);
	}
	.t-scenario {
		--c: var(--graph-scenario);
	}
	.t-page {
		--c: var(--graph-page);
	}
	.t-loc {
		--c: var(--graph-location);
	}
	.list ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}
	.list summary {
		cursor: pointer;
	}
</style>
