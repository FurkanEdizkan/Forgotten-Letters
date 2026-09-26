<script lang="ts">
	import Portrait from '$lib/components/Portrait.svelte';
	import { getLive } from '$lib/context';
	import { FACTIONS } from '$lib/rules/factions';

	const live = getLive();
	const s = $derived(live.current);
	const wb = $derived(new Map(s.warbands.map((w) => [w.id, w])));
	const faction = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? id;
</script>

<svelte:head><title>Standings · {s.campaign.name}</title></svelte:head>

<main>
	<h1>{s.campaign.visionsRevealed ? 'The Final Reckoning' : 'Standings'}</h1>
	{#if s.campaign.visionsRevealed}
		<p class="muted">Tracker CVP, Shared Objectives (Herald of Leviathan 6, Largest Enclave 8) and every Vision level achieved.</p>
	{:else}
		<p class="muted">Campaign Victory Points from the Trackers. Visions and Shared Objectives are revealed at the end.</p>
	{/if}
	<ol>
		{#each s.standings as row, i (row.id)}
			{@const w = wb.get(row.id)}
			{#if w}
				<li>
					<a href="/players/{w.id}">
						<span class="rank">{i + 1}</span>
						<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} size={48} />
						<span class="who">
							<strong>{w.player}</strong>
							<small>{w.name} · {w.variant ?? faction(w.faction)}</small>
						</span>
						<span class="bits">
							<span title="Games played">{w.games}/{s.campaign.gamesPerPlayer} games</span>
							<span title="Outposts">{w.outposts.length} ⚑</span>
							{#if w.omens}<span title="Omens of Leviathan">{w.omens} ◉</span>{/if}
							{#if s.campaign.visionsRevealed}
								<span title="Tracker CVP">{row.trackerCvp} tracker</span>
								{#if row.herald}<span>Herald +{row.herald}</span>{/if}
								{#if row.enclave}<span>Enclave +{row.enclave}</span>{/if}
								{#if w.vision}<span>{w.vision} {row.visionLevel}/3 +{row.visionCvp}</span>{/if}
							{/if}
						</span>
						<span class="score">{row.total}</span>
					</a>
				</li>
			{/if}
		{/each}
	</ol>
</main>

<style>
	main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 20px 16px 60px;
	}
	ol {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	a:hover {
		border-color: var(--blood);
	}
	.rank {
		width: 1.6em;
		text-align: right;
		font-family: var(--font-display);
		font-size: 1.3rem;
		color: var(--blood);
	}
	.who {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	small,
	.muted,
	.bits {
		color: var(--muted);
	}
	.bits {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 0.9em;
		justify-content: flex-end;
	}
	.score {
		min-width: 2.5em;
		text-align: right;
		font-size: 1.5rem;
		font-weight: 700;
	}
	@media (max-width: 34rem) {
		.bits {
			display: none;
		}
	}
</style>
