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

<main>
	<p class="crumbs"><a href="/">Map</a> · <a href="/zones">Zones</a></p>
	<div class="kicker">{kind}{zone.house ? ' · our campaign' : ''}</div>
	<h1>{zone.name}</h1>

	<div class="layout">
		<article class="lore">
			{#if data.loreImage}<img src={data.loreImage} alt="" />{/if}
			{#if data.loreHtml}
				{@html data.loreHtml}
			{:else}
				<p class="muted"><em>No lore has been written for this place yet.</em></p>
			{/if}
			{#if data.loreSource === 'guide'}<p class="source">From the Player's Guide.</p>{/if}
		</article>

		<aside>
			{#if battle}
				{@const we = battle.weatherEvent ? weatherByRoll(battle.weatherEvent) : null}
				<div class="battle">
					<strong>Battle in progress:</strong> {wb.get(battle.aggressor)?.player} attacks {wb.get(battle.defender)?.player}
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
					<summary class="res-{r}">{RESOURCE_NAMES[r]} table</summary>
					<table>
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
						{#if a}<Portrait name={a.player} portrait={a.portrait} symbol={a.symbol} size={32} />{/if}
						{#if d}<Portrait name={d.player} portrait={d.portrait} symbol={d.symbol} size={32} />{/if}
						<span>
							<strong>{w ? `${w.player} triumphed` : 'A bloody stalemate'}</strong>
							<small>{a?.player} attacked {d?.player}{g.scenario ? ` · ${g.scenario}` : ''}{g.weatherEvent ? ` · ${weatherByRoll(g.weatherEvent)?.name}` : ''} · {fmt(g.at)}</small>
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted"><em>No blood has been spilled here yet.</em></p>
		{/if}
	</section>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 16px 16px 60px;
	}
	.crumbs {
		margin: 0 0 6px;
		font-variant-caps: small-caps;
	}
	.kicker {
		font-variant-caps: small-caps;
		letter-spacing: 0.14em;
		color: var(--blood);
		font-weight: 600;
	}
	h1 {
		margin: 0 0 14px;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 24px;
	}
	@media (max-width: 44rem) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.lore {
		font-size: 1.08rem;
		line-height: 1.65;
	}
	.lore :global(p:first-of-type)::first-letter {
		font-family: var(--font-display);
		font-size: 2.6em;
		float: left;
		line-height: 0.85;
		padding: 4px 6px 0 0;
		color: var(--blood);
	}
	.lore img {
		width: 100%;
		border: 1px solid var(--rule);
		margin-bottom: 10px;
	}
	.lore :global(blockquote) {
		margin: 10px 0;
		padding-left: 12px;
		border-left: 3px solid var(--rule);
		font-style: italic;
	}
	.source {
		font-size: 0.85rem;
		color: var(--muted);
	}
	aside {
		padding: 12px 14px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		align-self: start;
	}
	aside h3 {
		margin: 12px 0 4px;
		font-variant-caps: small-caps;
		color: var(--blood);
		font-size: 1rem;
	}
	.links {
		margin: 0;
		line-height: 1.8;
	}
	.battle {
		margin-bottom: 10px;
		padding: 8px 10px;
		background: var(--paper);
		border-left: 3px solid var(--blood-bright);
	}
	section {
		margin-top: 28px;
	}
	details {
		margin: 6px 0;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	summary {
		cursor: pointer;
		padding: 6px 10px;
		font-weight: 600;
	}
	.res-F {
		color: var(--favour);
	}
	.res-R {
		color: var(--relics);
	}
	.res-S {
		color: var(--supplies);
	}
	.res-T {
		color: var(--territories);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	td {
		padding: 4px 10px;
		border-top: 1px solid var(--rule);
		vertical-align: top;
	}
	.roll {
		white-space: nowrap;
		font-weight: 700;
		color: var(--blood);
		width: 3.5em;
	}
	.history {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.history li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	.history span {
		display: grid;
	}
	.muted,
	small {
		color: var(--muted);
	}
</style>
