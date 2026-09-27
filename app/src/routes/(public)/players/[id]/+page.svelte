<script lang="ts">
	import Seal from '$lib/components/Seal.svelte';
	import { page } from '$app/state';
	import Portrait from '$lib/components/Portrait.svelte';
	import TrackerSheet from '$lib/components/TrackerSheet.svelte';
	import SealEditor from '$lib/components/SealEditor.svelte';
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
	const mine = $derived(!!page.data.user?.warbandIds.includes(page.params.id!));
	const canEdit = $derived(mine || !!page.data.isAdmin);
</script>

<svelte:head><title>{w?.player ?? 'Warband'} · {s.campaign.name}</title></svelte:head>

<main>
	{#if !w}
		<p>No such warband. <a href="/players">Standings</a></p>
	{:else}
		<div class="head">
			<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={96} />
			<div class="title">
				<h1>{w.player}</h1>
				<div class="sub">
					<strong>{w.name}</strong> · {w.variant ?? faction(w.faction)}{w.seat ? ` · Player ${w.seat}` : ''}{w.patron ? ` · Patron: ${w.patron}` : ''}
				</div>
			</div>
			<Seal look={w.seal} faction={w.faction} size={112} ignite label="{faction(w.faction)} seal" />
			<div class="total"><strong>{standing?.total ?? w.cvp}</strong><small>CVP</small></div>
		</div>

		<table class="stats">
			<thead>
				<tr>
					<th>Games</th>
					<th>Exploration</th>
					<th>Camp</th>
					<th>Omens · Apocrypha</th>
					{#if w.vision}<th>Vision</th>{/if}
				</tr>
			</thead>
			<tbody>
				<tr>
					<td data-label="Games">{w.games}/{s.campaign.gamesPerPlayer} · {w.wins} won</td>
					<td data-label="Exploration">{w.dice}D6{w.rerolls ? ` · ${w.rerolls} reroll` : ''}{w.sets ? ` · ${w.sets} set` : ''}{w.rollMod ? ' · ±1' : ''}</td>
					<td data-label="Camp">Shrine {ROMAN[w.buildings.shrine]} · Vault {ROMAN[w.buildings.vault]} · Depot {ROMAN[w.buildings.depot]} · Garrison {ROMAN[w.buildings.garrison]}</td>
					<td data-label="Omens · Apocrypha">{w.omens} · {w.apocrypha}</td>
					{#if w.vision}<td data-label="Vision">{w.vision} · level {standing?.visionLevel ?? 0}</td>{/if}
				</tr>
			</tbody>
		</table>

		{#if canEdit}
			<SealEditor warbandId={w.id} faction={w.faction} factionName={faction(w.faction)} look={w.seal} />
		{/if}

		<section class="roster">
			<div class="roster-head">
				<h2>The Warband</h2>
				<span class="bank"><strong>{w.treasury.ducats}</strong> Ducats · <strong>{w.treasury.glory}</strong> Glory in the bank</span>
			</div>
			<p>
				{w.units.length} model{w.units.length === 1 ? '' : 's'} mustered.
				<a href="/warbands/{w.id}">Open the warband{canEdit ? ' to recruit, equip and record the campaign' : ''} →</a>
			</p>
		</section>

		<TrackerSheet {w} />

		<div class="back">
			<section class="rules-box">
				<h3>Entry Zone</h3>
				<p>{w.entryZone} · {zoneName(w.entryZone)}</p>
			</section>
			<section class="rules-box">
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
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
	}
	.title {
		flex: 1;
		min-width: 12rem;
	}
	h1 {
		margin: 0 0 4px;
	}
	.sub {
		color: var(--ink-soft);
	}
	small {
		color: var(--muted);
	}
	.total {
		display: grid;
		justify-items: center;
		font-weight: 700;
		font-size: 2.8rem;
		line-height: 0.95;
		font-variant-numeric: lining-nums;
	}
	.total small {
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		color: var(--ink);
	}
	/* The book's profile table: grey header row, hairline body. */
	.stats {
		width: 100%;
		margin: 22px 0 8px;
		border-collapse: collapse;
		font-size: 0.95rem;
	}
	.stats th {
		padding: 4px 10px;
		background: var(--wash-deep);
		text-align: left;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.stats td {
		padding: 6px 10px;
		border-bottom: 1px solid var(--ink);
		vertical-align: top;
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
		margin: 0.6em 0 0.4em;
	}
	.back {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
		gap: 16px;
		margin-top: 24px;
	}
	.back p {
		margin: 0 0 4px;
	}
	.outpost {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-decoration-color: var(--blood);
	}
	@media (max-width: 40rem) {
		.stats thead {
			display: none;
		}
		.stats tr,
		.stats td {
			display: block;
		}
		.stats td {
			display: grid;
			grid-template-columns: 8.5rem 1fr;
			gap: 8px;
			border-bottom: 1px solid var(--rule);
		}
		.stats td::before {
			content: attr(data-label);
			font-size: 0.78rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			align-self: center;
		}
	}
</style>
