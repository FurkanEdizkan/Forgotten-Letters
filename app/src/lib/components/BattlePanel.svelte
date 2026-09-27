<script lang="ts">
	import Seal from './Seal.svelte';
	import type { Snippet } from 'svelte';
	import Portrait from './Portrait.svelte';
	import UnitCard from './UnitCard.svelte';
	import Mark from './Mark.svelte';
	import { RESOURCES, RESOURCE_NAMES, type Zone } from '$lib/rules/types';
	import { weatherByRoll } from '$lib/rules/weather';
	import type { PublicGame, PublicSnapshot, PublicWarband } from '$lib/snapshot';

	let {
		game,
		zone,
		snapshot,
		zoneName,
		controls
	}: {
		game: PublicGame;
		zone: Zone;
		snapshot: PublicSnapshot;
		zoneName: (id: string) => string;
		/** Campaign Master controls (arranging, rolling, starting), rendered under the header. */
		controls?: Snippet;
	} = $props();

	const wb = $derived(new Map(snapshot.warbands.map((w) => [w.id, w])));
	const sides = $derived(
		[
			{ w: wb.get(game.aggressor), role: 'Aggressor' as const },
			{ w: wb.get(game.defender), role: 'Defender' as const }
		].filter((s): s is { w: PublicWarband; role: 'Aggressor' | 'Defender' } => !!s.w)
	);
	const weather = $derived(game.weatherEvent ? weatherByRoll(game.weatherEvent) : null);
	const reason = $derived(
		game.aggressorReason === 'fewer'
			? 'has been Aggressor fewer times'
			: game.aggressorReason === 'roll-off'
				? 'won the roll-off'
				: game.aggressorReason === 'chosen'
					? 'chosen by the Campaign Master'
					: ''
	);
	const standing = (id: string) => snapshot.standings.findIndex((s) => s.id === id) + 1;
	const ROMAN = ['—', 'I', 'II', 'III'];
	let openRoster = $state<Record<string, boolean>>({});
</script>

<div class="panel">
	<h2>{zone.name}</h2>
	<p class="meta">
		<strong class="status" class:live={game.status === 'in_progress'}>{game.status === 'scheduled' ? 'Planned battle' : game.status === 'in_progress' ? 'Battle in progress' : 'Battle'}</strong>
		· {game.scenario ?? (zone.scenario ? zone.scenario : 'Scenario to be rolled')}
		· <a href="/zones/{zone.id}">Lore</a>
	</p>
	<div class="weather rules-box">
		<h3>Hell on Earth</h3>
		{#if weather}
			<p><strong>{weather.name}.</strong> {weather.effect}</p>
		{:else}
			<p class="muted">Not yet rolled.</p>
		{/if}
	</div>

	{#if controls}<div class="controls">{@render controls()}</div>{/if}

	<div class="sides">
		{#each sides as { w, role } (w.id)}
			<section class="side" class:agg={role === 'Aggressor'}>
				<header>
					<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={52} />
					<div>
						<span class="role">{role}</span>
						<strong>{w.player}</strong>
						<small>{w.name}</small>
						{#if role === 'Aggressor' && reason}<small class="why">{reason}</small>{/if}
					</div>
					<span class="side-seal"><Seal look={w.seal} faction={w.faction} size={64} ignite igniteDelay={role === 'Aggressor' ? 150 : 700} phase={role === 'Aggressor' ? 0 : 0.5} /></span>
				</header>

				<table class="numbers">
					<thead>
						<tr><th>CVP</th><th>Ducats</th><th>Glory</th><th>Games</th><th>Explore</th>{#if w.omens}<th>Omens</th>{/if}</tr>
					</thead>
					<tbody>
						<tr>
							<td>{w.cvp} <small>#{standing(w.id)}</small></td>
							<td>{w.treasury.ducats}</td>
							<td>{w.treasury.glory}</td>
							<td>{w.games}/{snapshot.campaign.gamesPerPlayer}</td>
							<td>{w.dice}D6</td>
							{#if w.omens}<td>{w.omens}</td>{/if}
						</tr>
					</tbody>
				</table>

				<div class="tracks">
					{#each RESOURCES as r (r)}
						<div class="track" title="{RESOURCE_NAMES[r]} {w.tracks[r]}/15">
							<span class="res-{r}">{r}</span>
							<span class="bar"><span class="fill res-bg-{r}" style:width="{(w.tracks[r] / 15) * 100}%"></span></span>
							<small>{w.tracks[r]}</small>
						</div>
					{/each}
				</div>
				<p class="small">
					Camp: Shrine {ROMAN[w.buildings.shrine]} · Vault {ROMAN[w.buildings.vault]} · Depot {ROMAN[w.buildings.depot]} · Garrison {ROMAN[w.buildings.garrison]}
				</p>

				<div class="outposts">
					<span class="label"><Mark name="pennant" /> Outposts</span>
					{#each w.outposts as z (z)}
						<a href="/zones/{z}" class:supplied={w.supplied.includes(z)} title={w.supplied.includes(z) ? 'Supplied' : 'Cut off'}>{zoneName(z)}</a>
					{:else}
						<small class="muted">none yet</small>
					{/each}
				</div>

				<button type="button" class="roster-toggle" aria-expanded={!!openRoster[w.id]} onclick={() => (openRoster[w.id] = !openRoster[w.id])}>
					<span class="chev" class:open={openRoster[w.id]}><Mark name="chevron" /></span> Warband ({w.units.length} model{w.units.length === 1 ? '' : 's'})
				</button>
				{#if openRoster[w.id]}
					<div class="units">
						{#each w.units as u (u.id)}<UnitCard unit={u} photo={u.photo} art={u.art} compact />{:else}<small class="muted">No roster yet.</small>{/each}
					</div>
				{/if}
				<span class="tracker"><a href="/warbands/{w.id}">Warband</a> · <a href="/players/{w.id}">Campaign Tracker</a></span>
			</section>
		{/each}
	</div>
</div>

<style>
	h2 {
		margin: 0;
		font-size: 2.2rem;
	}
	.meta {
		margin: 4px 0 12px;
	}
	.status {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.85rem;
	}
	.status.live {
		color: var(--blood);
	}
	.weather p {
		margin: 0;
	}
	.controls {
		margin: 12px 0 4px;
	}
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 20px;
		margin-top: 16px;
	}
	.side {
		display: grid;
		gap: 10px;
		align-content: start;
		padding-top: 10px;
		border-top: 2px solid var(--ink);
	}
	.side.agg {
		border-top-color: var(--blood);
	}
	header {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	header div {
		display: grid;
		flex: 1;
		min-width: 0;
		line-height: 1.2;
	}
	.side-seal {
		display: flex;
		margin-left: auto;
	}
	header strong {
		font-size: 1.15rem;
	}
	.role {
		font-family: var(--font-title);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.95rem;
		color: var(--ink-soft);
	}
	.agg .role {
		color: var(--blood);
	}
	.why {
		font-style: italic;
	}
	.numbers {
		width: 100%;
		border-collapse: collapse;
		text-align: center;
		font-size: 0.92rem;
	}
	.numbers th {
		padding: 2px 4px;
		background: var(--wash-deep);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.numbers td {
		padding: 3px 4px;
		border-bottom: 1px solid var(--ink);
		font-weight: 700;
	}
	.numbers td small {
		font-weight: 400;
	}
	.tracks {
		display: grid;
		gap: 3px;
	}
	.track {
		display: grid;
		grid-template-columns: 1.2em 1fr 1.6em;
		gap: 6px;
		align-items: center;
		font-weight: 700;
		font-variant-numeric: lining-nums;
	}
	.bar {
		height: 8px;
		background: var(--paper);
		border: 1px solid var(--ink);
	}
	.fill {
		display: block;
		height: 100%;
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
	.res-bg-F {
		background: var(--favour);
	}
	.res-bg-R {
		background: var(--relics);
	}
	.res-bg-S {
		background: var(--supplies);
	}
	.res-bg-T {
		background: var(--territories);
	}
	.small {
		margin: 0;
		font-size: 0.88rem;
	}
	.outposts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: baseline;
		font-size: 0.92rem;
	}
	.label {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.8rem;
		color: var(--blood);
	}
	.outposts a.supplied {
		text-decoration-color: var(--supplies);
		text-decoration-thickness: 2px;
	}
	.roster-toggle {
		justify-self: start;
		padding: 3px 10px 3px 6px;
		background: none;
		border: 1px solid var(--rule);
		color: var(--ink);
		font-size: 0.8rem;
	}
	.roster-toggle:hover {
		background: none;
		color: var(--blood);
		border-color: var(--blood);
	}
	.chev {
		display: inline-flex;
		transition: transform 0.2s var(--ease-out);
	}
	.chev.open {
		transform: rotate(90deg);
	}
	.units {
		display: grid;
		gap: 6px;
	}
	.tracker {
		font-size: 0.92rem;
	}
	.muted,
	small {
		color: var(--muted);
	}
</style>
