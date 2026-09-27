<script lang="ts">
	import { page } from '$app/state';
	import Portrait from '$lib/components/Portrait.svelte';
	import { FACTIONS } from '$lib/rules/factions';

	const s = $derived(page.data.snapshot);
	const name = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? id;
	const players = $derived(new Set((s?.warbands ?? []).map((w: { player: string }) => w.player)).size);
	const games = $derived((s?.warbands ?? []).reduce((n: number, w: { games: number }) => n + w.games, 0) / 2);
</script>

<svelte:head><title>{s?.campaign.name ?? 'Campaign'}</title></svelte:head>

<main>
	{#if s}
		<h1>{s.campaign.name}</h1>
		<p class="meta">
			Players: {players} | Warbands: {s.warbands.length} | Games fought: {games} of {(s.campaign.gamesPerPlayer * s.warbands.length) / 2} ·
			<a href="/">The Carcass Front map</a> · <a href="/players">Standings</a> · <a href="/history">Chronicle</a>
		</p>
		<ul class="roll">
			{#each s.standings as row, i (row.id)}
				{@const w = s.warbands.find((x: { id: string }) => x.id === row.id)}
				{#if w}
					<li>
						<a href="/warbands/{w.id}">
							<span class="rank">{i + 1}</span>
							<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={56} />
							<span class="who"><strong>{w.player}</strong><small>{w.name} · {w.variant ?? name(w.faction)}</small></span>
							<span class="nums"><strong>{row.total}</strong> CVP<small>{w.games}/{s.campaign.gamesPerPlayer} games · {w.units.length} models</small></span>
						</a>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.meta {
		color: var(--ink-soft);
	}
	.roll {
		list-style: none;
		padding: 0;
		margin: 16px 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: 0 28px;
		border-top: 2px solid var(--ink);
	}
	.roll a {
		display: grid;
		grid-template-columns: 1.8rem auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 10px 2px;
		border-bottom: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	.roll a:hover strong {
		color: var(--blood);
	}
	.rank {
		font-family: var(--font-display);
		font-size: 1.4rem;
		color: var(--blood);
		text-align: right;
	}
	.who,
	.nums {
		display: grid;
		line-height: 1.3;
		min-width: 0;
	}
	.nums {
		text-align: right;
		font-variant-numeric: lining-nums;
	}
	small {
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
