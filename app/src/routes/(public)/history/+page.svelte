<script lang="ts">
	import Portrait from '$lib/components/Portrait.svelte';
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import { weatherByRoll } from '$lib/rules/weather';

	const live = getLive();
	const s = $derived(live.current);
	const wb = $derived(new Map(s.warbands.map((w) => [w.id, w])));
	const graph = $derived(buildGraph(s.campaign.houseZones));
	const fmt = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Chronicle · {s.campaign.name}</title></svelte:head>

<main>
	<h1>The Chronicle</h1>
	{#if s.merchantTier}
		<p class="notice">Merchants walk the front: every warband may buy Glory Items costing up to {s.merchantTier} Glory.</p>
	{/if}
	<ol>
		{#each s.recent as g (g.id)}
			{@const a = wb.get(g.aggressor)}
			{@const d = wb.get(g.defender)}
			{@const winner = g.winner ? wb.get(g.winner) : null}
			<li>
				<span class="pair">
					{#if a}<Portrait name={a.player} portrait={a.portrait} symbol={a.symbol} size={40} />{/if}
					{#if d}<Portrait name={d.player} portrait={d.portrait} symbol={d.symbol} size={40} />{/if}
				</span>
				<span class="what">
					<strong>{winner ? `${winner.player} triumphed` : 'A bloody stalemate'}</strong> at {graph.zones.get(g.zone)?.name ?? g.zone}
					<small>
						{a?.player} attacked {d?.player}{g.scenario ? ` · ${g.scenario}` : ''}{g.weatherEvent ? ` · ${weatherByRoll(g.weatherEvent)?.name}` : ''} · {fmt(g.at)}
					</small>
				</span>
			</li>
		{:else}
			<li class="muted"><em>No battles recorded yet.</em></li>
		{/each}
	</ol>
</main>

<style>
	main {
		max-width: 50rem;
		margin: 0 auto;
		padding: 20px 16px 60px;
	}
	ol {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	.pair {
		display: flex;
	}
	.what {
		display: grid;
	}
	small,
	.muted {
		color: var(--muted);
	}
	.notice {
		padding: 8px 12px;
		border-left: 3px solid var(--territories);
		background: var(--parchment);
	}
</style>
