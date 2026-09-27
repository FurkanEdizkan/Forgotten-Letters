<script lang="ts">
	import Portrait from '$lib/components/Portrait.svelte';
	import Mark from '$lib/components/Mark.svelte';
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
		<p class="lede">Tracker CVP, Shared Objectives (Herald of Leviathan 6, Largest Enclave 8) and every Vision level achieved.</p>
	{:else}
		<p class="lede">Campaign Victory Points from the Trackers. Visions and Shared Objectives are revealed at the end.</p>
	{/if}
	<div class="ledger" role="table" aria-label="Standings">
		<div class="row head" role="row">
			<span role="columnheader" class="rank">#</span>
			<span role="columnheader" class="who">Warband</span>
			<span role="columnheader" class="bits">Record</span>
			<span role="columnheader" class="score">CVP</span>
		</div>
		{#each s.standings as row, i (row.id)}
			{@const w = wb.get(row.id)}
			{#if w}
				<a class="row" role="row" href="/players/{w.id}">
					<span role="cell" class="rank">{i + 1}</span>
					<span role="cell" class="who">
						<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={44} />
						<span class="names">
							<strong>{w.player}</strong>
							<small>{w.name} · {w.variant ?? faction(w.faction)}</small>
						</span>
					</span>
					<span role="cell" class="bits">
						<span title="Games played">{w.games}/{s.campaign.gamesPerPlayer} games</span>
						<span title="Outposts"><Mark name="pennant" /> {w.outposts.length}</span>
						{#if w.omens}<span title="Omens of Leviathan">{w.omens} Omen{w.omens > 1 ? 's' : ''}</span>{/if}
						{#if s.campaign.visionsRevealed}
							<span title="Tracker CVP">{row.trackerCvp} tracker</span>
							{#if row.herald}<span>Herald +{row.herald}</span>{/if}
							{#if row.enclave}<span>Enclave +{row.enclave}</span>{/if}
							{#if w.vision}<span>{w.vision} {row.visionLevel}/3 +{row.visionCvp}</span>{/if}
						{/if}
					</span>
					<span role="cell" class="score">{row.total}</span>
				</a>
			{/if}
		{/each}
	</div>
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.lede {
		max-width: 60ch;
		margin: 0 0 22px;
		color: var(--ink-soft);
	}
	.ledger {
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
	}
	.row {
		display: grid;
		grid-template-columns: 2.4rem minmax(0, 1fr) auto 4rem;
		align-items: center;
		gap: 14px;
		padding: 8px 12px;
		color: inherit;
		text-decoration: none;
		border-top: 1px solid var(--rule);
		transition: background-color 0.18s var(--ease-out);
	}
	a.row:hover {
		background: var(--parchment);
	}
	a.row:hover strong {
		color: var(--blood);
	}
	.head {
		border-top: none;
		background: var(--wash-deep);
		padding-block: 5px;
		font-weight: 700;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.rank {
		text-align: right;
		font-family: var(--font-display);
		font-size: 1.6rem;
		line-height: 1;
		color: var(--blood);
	}
	.head .rank {
		font-family: var(--font-body);
		font-size: inherit;
		color: inherit;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.names {
		display: grid;
		min-width: 0;
		line-height: 1.25;
	}
	.names strong {
		font-size: 1.1rem;
		transition: color 0.18s var(--ease-out);
	}
	small {
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bits {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 16px;
		justify-content: flex-end;
		color: var(--ink-soft);
		font-size: 0.92rem;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.bits span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.score {
		text-align: right;
		font-weight: 700;
		font-size: 1.7rem;
		line-height: 1;
		font-variant-numeric: lining-nums;
	}
	.head .score {
		font-family: var(--font-body);
		font-size: inherit;
	}
	@media (max-width: 40rem) {
		.row {
			grid-template-columns: 1.8rem minmax(0, 1fr) 3rem;
			gap: 10px;
			padding-inline: 6px;
		}
		.bits {
			display: none;
		}
	}
</style>
