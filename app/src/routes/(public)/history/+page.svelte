<script lang="ts">
	import Portrait from '$lib/components/Portrait.svelte';
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import { weatherByRoll } from '$lib/rules/weather';

	const live = getLive();
	const s = $derived(live.current);
	const wb = $derived(new Map(s.warbands.map((w) => [w.id, w])));
	const graph = $derived(buildGraph(s.campaign.houseZones));
	const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	const hour = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>Chronicle · {s.campaign.name}</title></svelte:head>

<main>
	<h1>The Chronicle</h1>
	{#if s.merchantTier}
		<p class="notice rules-box">Merchants walk the front: every warband may buy Glory Items costing up to {s.merchantTier} Glory.</p>
	{/if}
	<ol>
		{#each s.recent as g (g.id)}
			{@const a = wb.get(g.aggressor)}
			{@const d = wb.get(g.defender)}
			{@const winner = g.winner ? wb.get(g.winner) : null}
			<li>
				<time datetime={new Date(g.at).toISOString()}><span>{day(g.at)}</span><span>{hour(g.at)}</span></time>
				<span class="pair">
					{#if a}<Portrait name={a.player} portrait={a.portrait} symbol={a.symbol} faction={a.faction} seal={a.seal} size={40} />{/if}
					{#if d}<Portrait name={d.player} portrait={d.portrait} symbol={d.symbol} faction={d.faction} seal={d.seal} size={40} />{/if}
				</span>
				<span class="what">
					<strong>{winner ? `${winner.player} triumphed` : 'A bloody stalemate'}</strong>
					<span class="at">at <a href="/zones/{g.zone}">{graph.zones.get(g.zone)?.name ?? g.zone}</a></span>
					<small>
						{a?.player} attacked {d?.player}{g.scenario ? ` · ${g.scenario}` : ''}{g.weatherEvent ? ` · ${weatherByRoll(g.weatherEvent)?.name}` : ''}
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
		max-width: 52rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}
	li {
		display: grid;
		grid-template-columns: 7.5rem auto minmax(0, 1fr);
		align-items: center;
		gap: 14px;
		padding: 12px 2px;
		border-bottom: 1px solid var(--rule);
	}
	time {
		display: grid;
		font-size: 0.82rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--blood);
		font-variant-numeric: lining-nums;
	}
	.pair {
		display: flex;
	}
	.pair :global(.portrait + .portrait) {
		margin-left: -10px;
	}
	.what {
		display: grid;
		line-height: 1.3;
	}
	.what strong {
		font-size: 1.12rem;
	}
	.at a {
		font-family: var(--font-display);
		font-size: 1.15rem;
		text-decoration: none;
	}
	small,
	.muted {
		color: var(--muted);
	}
	li.muted {
		display: block;
	}
	.notice {
		max-width: 60ch;
		margin: 0 0 20px;
	}
	@media (max-width: 36rem) {
		li {
			grid-template-columns: auto minmax(0, 1fr);
		}
		time {
			grid-column: 1 / -1;
			display: flex;
			gap: 8px;
		}
	}
</style>
