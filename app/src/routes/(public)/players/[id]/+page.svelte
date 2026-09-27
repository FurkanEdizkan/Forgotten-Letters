<script lang="ts">
	import { page } from '$app/state';
	import Portrait from '$lib/components/Portrait.svelte';
	import TrackerSheet from '$lib/components/TrackerSheet.svelte';
	import UnitCard from '$lib/components/UnitCard.svelte';
	import { getLive } from '$lib/context';
	import { FACTIONS } from '$lib/rules/factions';
	import { buildGraph } from '$lib/rules/zones';

	const live = getLive();
	const s = $derived(live.current);
	const w = $derived(s.warbands.find((x) => x.id === page.params.id));
	const standing = $derived(s.standings.find((x) => x.id === page.params.id));
	const graph = $derived(buildGraph(s.campaign.houseZones));
	const zoneName = (id: string) => graph.zones.get(id)?.name ?? id;
	const faction = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? id;
	const ROMAN = ['—', 'I', 'II', 'III'];
</script>

<svelte:head><title>{w?.player ?? 'Warband'} · {s.campaign.name}</title></svelte:head>

<main>
	{#if !w}
		<p>No such warband. <a href="/players">Standings</a></p>
	{:else}
		<div class="head">
			<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} size={96} />
			<div>
				<div class="kicker">{w.seat ? `P${w.seat} · ` : ''}{w.variant ?? faction(w.faction)}</div>
				<h1>{w.player}</h1>
				<div class="sub">{w.name}{w.patron ? ` · Patron: ${w.patron}` : ''}</div>
			</div>
			<div class="total"><strong>{standing?.total ?? w.cvp}</strong><small>CVP</small></div>
		</div>

		<div class="facts">
			<div><small>Games</small>{w.games}/{s.campaign.gamesPerPlayer} · {w.wins} won</div>
			<div><small>Exploration</small>{w.dice}D6{w.rerolls ? ` · ${w.rerolls} reroll` : ''}{w.sets ? ` · ${w.sets} set` : ''}{w.rollMod ? ' · ±1' : ''}</div>
			<div><small>Camp</small>Shrine {ROMAN[w.buildings.shrine]} · Vault {ROMAN[w.buildings.vault]} · Depot {ROMAN[w.buildings.depot]} · Garrison {ROMAN[w.buildings.garrison]}</div>
			<div><small>Omens · Apocrypha</small>{w.omens} · {w.apocrypha}</div>
			{#if w.vision}<div><small>Vision</small>{w.vision} · level {standing?.visionLevel ?? 0}</div>{/if}
		</div>

		<section class="roster">
			<div class="roster-head">
				<h2>The Warband</h2>
				<span class="bank"><strong>{w.treasury.ducats}</strong> Ducats · <strong>{w.treasury.glory}</strong> Glory in the bank</span>
			</div>
			{#if w.units.length}
				<div class="units">
					{#each w.units as u (u.id)}<UnitCard unit={u} photo={u.photo} />{/each}
				</div>
			{:else}
				<p class="muted"><em>The roster has not been mustered here yet.</em></p>
			{/if}
		</section>

		<TrackerSheet {w} />

		<div class="back">
			<section>
				<h3>Entry Zone</h3>
				<p>{w.entryZone} · {zoneName(w.entryZone)}</p>
			</section>
			<section>
				<h3>Scouted Zones</h3>
				<p>
					{#each w.scouted as z, i (z)}{i ? ', ' : ''}<span class:outpost={w.outposts.includes(z)}>{zoneName(z)}</span>{:else}<em>None yet</em>{/each}
				</p>
				<small>Underlined: Outpost. Supplied: {w.supplied.map(zoneName).join(', ') || 'none'}.</small>
			</section>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 20px 16px 60px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.head > div:nth-child(2) {
		flex: 1;
		min-width: 12rem;
	}
	h1 {
		margin: 0;
	}
	.kicker {
		font-variant-caps: small-caps;
		letter-spacing: 0.12em;
		color: var(--blood);
		font-weight: 600;
	}
	.sub,
	small {
		color: var(--muted);
	}
	.total {
		display: grid;
		text-align: center;
		font-size: 2.4rem;
		line-height: 1;
	}
	.total small {
		font-size: 0.9rem;
		font-variant-caps: small-caps;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 8px;
		margin: 16px 0;
	}
	.facts > div {
		display: grid;
		padding: 6px 10px;
		border-left: 3px solid var(--blood);
		background: var(--parchment);
	}
	.roster {
		margin: 18px 0;
	}
	.roster-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px 16px;
	}
	.roster-head h2 {
		margin: 0 0 6px;
	}
	.units {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 8px;
	}
	.muted {
		color: var(--muted);
	}
	.back {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
		gap: 14px;
		margin-top: 14px;
	}
	.back section {
		padding: 10px 12px;
		border: 1px solid var(--rule);
	}
	h3 {
		margin: 0 0 4px;
		font-variant-caps: small-caps;
		color: var(--blood);
	}
	.outpost {
		text-decoration: underline;
		text-decoration-thickness: 2px;
	}
</style>
