<script lang="ts">
	import { page } from '$app/state';
	import Portrait from '$lib/components/Portrait.svelte';
	import ZoneFacts from '$lib/components/ZoneFacts.svelte';
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import { EXPLORATION_TABLES } from '$lib/rules/exploration';
	import { RESOURCE_NAMES } from '$lib/rules/types';
	import { weatherByRoll } from '$lib/rules/weather';

	let { data } = $props();

	const live = getLive();
	const s = $derived(live.current);
	const graph = $derived(buildGraph(s.campaign.houseZones));
	const zone = $derived(graph.zones.get(page.params.id!)!);
	const neighbours = $derived([...(graph.adj.get(zone.id) ?? [])].map((id) => graph.zones.get(id)!).sort((a, b) => a.name.localeCompare(b.name)));
	const wb = $derived(new Map(s.warbands.map((w) => [w.id, w])));
	const battle = $derived(s.active.find((g) => g.zone === zone.id));
	const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });
	const kind = $derived(zone.type === 'entry' ? 'Entry Zone' : zone.type === 'special' ? 'Special Zone' : 'Zone');
</script>

<svelte:head><title>{zone.name} · {s.campaign.name}</title></svelte:head>

<header class="spread" class:has-art={!!data.loreImage}>
	{#if data.loreImage}<img class="art" src={data.loreImage} alt="" />{/if}
	<div class="spread-inner">
		<h1>{zone.name}</h1>
		<p class="kind">{kind}{zone.house ? ' of our campaign' : ''}</p>
		<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Map</a> <span aria-hidden="true">/</span> <a href="/zones">All zones</a></nav>
	</div>
</header>

<main>

	<div class="layout">
		<article class="lore">
			{#if data.loreHtml}
				{@html data.loreHtml}
			{:else}
				<p class="muted"><em>No lore has been written for this place yet.</em></p>
			{/if}
			{#if data.loreSource === 'guide'}<p class="source">From the Player's Guide.</p>{/if}
		</article>

		<aside class="rules-box">
			{#if battle}
				{@const we = battle.weatherEvent ? weatherByRoll(battle.weatherEvent) : null}
				<div class="battle">
					<strong>{battle.status === 'scheduled' ? 'Battle planned' : 'Battle in progress'}:</strong> {wb.get(battle.aggressor)?.player} attacks {wb.get(battle.defender)?.player}
					{#if battle.scenario}<br />{battle.scenario}{/if}
					{#if we}<br /><em>{we.name}</em> — {we.effect}{/if}
				</div>
			{/if}
			<ZoneFacts {zone} snapshot={s} />
			<h3>Linked to</h3>
			<p class="links">
				{#each neighbours as n, i (n.id)}{i ? ' · ' : ''}<a href="/zones/{n.id}">{n.name}</a>{/each}
			</p>
		</aside>
	</div>

	{#if zone.resources.length}
		<section>
			<h2>Exploration here</h2>
			<p class="muted">The Aggressor rolls on one of these tables after a game in this zone.</p>
			{#each zone.resources as r (r)}
				<details>
					<summary class="res-{r}"><span class="disc">{r}</span>{RESOURCE_NAMES[r]} table</summary>
					<table>
						<thead><tr><th>Roll</th><th>Result</th></tr></thead>
						<tbody>
							{#each EXPLORATION_TABLES[r] as row (row.name)}
								<tr>
									<td class="roll">{row.min}{row.max === Infinity ? '+' : row.max !== row.min ? `–${row.max}` : ''}</td>
									<td><strong>{row.name}</strong> <span class="muted">— {row.summary}</span></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</details>
			{/each}
		</section>
	{/if}

	<section>
		<h2>Battles fought here</h2>
		{#if data.history.length}
			<ul class="history">
				{#each data.history as g (g.id)}
					{@const a = wb.get(g.aggressor)}
					{@const d = wb.get(g.defender)}
					{@const w = g.winner ? wb.get(g.winner) : null}
					<li>
						{#if a}<Portrait name={a.player} portrait={a.portrait} symbol={a.symbol} faction={a.faction} seal={a.seal} size={32} />{/if}
						{#if d}<Portrait name={d.player} portrait={d.portrait} symbol={d.symbol} faction={d.faction} seal={d.seal} size={32} />{/if}
						<span>
							<strong>{w ? `${w.player} triumphed` : 'A bloody stalemate'}</strong>
							<small>{a?.player} attacked {d?.player}{g.scenario ? ` · ${g.scenario}` : ''}{g.weatherEvent ? ` · ${weatherByRoll(g.weatherEvent)?.name}` : ''} · {fmt(g.at)}</small>
						</span>
						<a class="replay" href="/?replay={g.id}">Replay on the map</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted"><em>No blood has been spilled here yet.</em></p>
		{/if}
	</section>
</main>

<style>
	.replay {
		margin-left: auto;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	/* A zone's head: on white paper like a section of the book; with art, one of its painted spreads. */
	.spread {
		position: relative;
		overflow: hidden;
	}
	.has-art {
		background: var(--night);
		color: var(--bone);
		border-bottom: 2px solid var(--blood);
	}
	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.6;
	}
	.has-art::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--night) 8%, rgba(21, 19, 14, 0.2) 70%);
	}
	.spread-inner {
		position: relative;
		z-index: 1;
		max-width: 60rem;
		margin: 0 auto;
		padding: 32px clamp(16px, 4vw, 40px) 0;
	}
	.has-art .spread-inner {
		padding-top: clamp(90px, 18vw, 200px);
		padding-bottom: 24px;
	}
	.spread h1 {
		margin: 0 0 4px;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 1.8rem + 3vw, 4.2rem);
		letter-spacing: 0;
		text-transform: none;
		line-height: 1;
		color: var(--blood);
	}
	.has-art h1 {
		color: var(--bone);
	}
	.kind {
		margin: 0;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--ink);
		font-weight: 700;
		font-size: 0.9rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.has-art .kind {
		border-color: rgba(236, 229, 211, 0.4);
	}
	.crumbs {
		display: flex;
		gap: 8px;
		margin-top: 6px;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.crumbs a {
		color: inherit;
	}
	.crumbs a:hover {
		color: var(--blood);
	}
	.has-art .crumbs,
	.has-art .crumbs a {
		color: var(--bone-dim);
	}
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 24px clamp(16px, 4vw, 40px) 0;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 32px;
	}
	@media (max-width: 44rem) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.lore {
		max-width: 68ch;
		font-size: 1.08rem;
		line-height: 1.65;
	}
	.lore :global(p:first-of-type)::first-letter {
		font-family: var(--font-display);
		font-size: 3.4em;
		float: left;
		line-height: 0.8;
		padding: 6px 8px 0 0;
		color: var(--blood);
	}
	.lore :global(blockquote) {
		margin: 16px 0;
		padding: 0 12px;
		font-family: var(--font-display);
		font-size: 1.2rem;
		line-height: 1.3;
		color: var(--blood);
	}
	.source {
		font-size: 0.85rem;
		color: var(--muted);
	}
	aside {
		align-self: start;
	}
	aside h3 {
		margin: 16px 0 6px;
	}
	.links {
		margin: 0;
		line-height: 1.8;
	}
	.battle {
		margin-bottom: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--blood);
	}
	section {
		margin-top: 36px;
	}
	section h2 {
		margin-top: 0;
	}
	details {
		margin: 8px 0;
		border-top: 2px solid var(--ink);
	}
	summary {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		padding: 8px 2px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	summary:hover {
		color: var(--blood);
	}
	.disc {
		display: inline-grid;
		place-items: center;
		width: 1.5em;
		height: 1.5em;
		border-radius: 50%;
		border: 1.5px solid var(--ink);
		font-size: 0.8rem;
		color: #fff;
		background: var(--c);
	}
	.res-F {
		--c: var(--favour);
	}
	.res-R {
		--c: var(--relics);
	}
	.res-S {
		--c: var(--supplies);
	}
	.res-T {
		--c: var(--territories);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 12px;
	}
	th {
		padding: 3px 10px;
		background: var(--wash-deep);
		text-align: left;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}
	.roll {
		white-space: nowrap;
		font-weight: 700;
		color: var(--blood);
		width: 4em;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.history {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}
	.history li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 4px;
		border-bottom: 1px solid var(--rule);
	}
	.history span {
		display: grid;
	}
	.muted,
	small {
		color: var(--muted);
	}
</style>
