<script lang="ts">
	import type { Snippet } from 'svelte';
	import Portrait from './Portrait.svelte';
	import UnitCard from './UnitCard.svelte';
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
	<div class="kicker">{game.status === 'scheduled' ? 'Planned battle' : game.status === 'in_progress' ? 'Battle in progress' : 'Battle'}</div>
	<h2>{zone.name}</h2>
	<p class="meta">
		{game.scenario ?? (zone.scenario ? zone.scenario : 'Scenario to be rolled')}
		· <a href="/zones/{zone.id}">lore</a>
	</p>
	{#if weather}
		<div class="weather"><strong>{weather.name}</strong> — {weather.effect}</div>
	{:else}
		<div class="weather muted">Hell on Earth not yet rolled.</div>
	{/if}

	{#if controls}<div class="controls">{@render controls()}</div>{/if}

	<div class="sides">
		{#each sides as { w, role } (w.id)}
			<section class="side" class:agg={role === 'Aggressor'}>
				<header>
					<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} size={52} />
					<div>
						<span class="role">{role}</span>
						<strong>{w.player}</strong>
						<small>{w.name}</small>
						{#if role === 'Aggressor' && reason}<small class="why">{reason}</small>{/if}
					</div>
				</header>

				<dl class="numbers">
					<div><dt>CVP</dt><dd>{w.cvp} <small>#{standing(w.id)}</small></dd></div>
					<div><dt>Ducats</dt><dd>{w.treasury.ducats}</dd></div>
					<div><dt>Glory</dt><dd>{w.treasury.glory}</dd></div>
					<div><dt>Games</dt><dd>{w.games}/{snapshot.campaign.gamesPerPlayer}</dd></div>
					<div><dt>Explore</dt><dd>{w.dice}D6</dd></div>
					{#if w.omens}<div><dt>Omens</dt><dd>{w.omens}</dd></div>{/if}
				</dl>

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
					<span class="label">Outposts</span>
					{#each w.outposts as z (z)}
						<a href="/zones/{z}" class:supplied={w.supplied.includes(z)} title={w.supplied.includes(z) ? 'Supplied' : 'Cut off'}>{zoneName(z)}</a>
					{:else}
						<small class="muted">none yet</small>
					{/each}
				</div>

				<button type="button" class="roster-toggle" onclick={() => (openRoster[w.id] = !openRoster[w.id])}>
					{openRoster[w.id] ? '▾' : '▸'} Warband ({w.units.length} model{w.units.length === 1 ? '' : 's'})
				</button>
				{#if openRoster[w.id]}
					<div class="units">
						{#each w.units as u (u.id)}<UnitCard unit={u} photo={u.photo} compact />{:else}<small class="muted">No roster yet.</small>{/each}
					</div>
				{/if}
				<a class="tracker" href="/players/{w.id}">Campaign Tracker →</a>
			</section>
		{/each}
	</div>
</div>

<style>
	.kicker {
		font-variant-caps: small-caps;
		letter-spacing: 0.12em;
		color: var(--blood);
		font-weight: 600;
	}
	h2 {
		margin: 0;
		font-size: 1.8rem;
	}
	.meta {
		margin: 2px 0 6px;
	}
	.weather {
		padding: 6px 10px;
		background: var(--parchment);
		border-left: 3px solid var(--blood-bright);
	}
	.controls {
		margin: 10px 0 4px;
	}
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 10px;
		margin-top: 10px;
	}
	.side {
		display: grid;
		gap: 8px;
		align-content: start;
		padding: 10px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--rule);
	}
	.side.agg {
		border-top-color: var(--blood);
	}
	header {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	header div {
		display: grid;
		line-height: 1.2;
	}
	.role {
		font-variant-caps: small-caps;
		letter-spacing: 0.1em;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.agg .role {
		color: var(--blood);
	}
	.why {
		font-style: italic;
		color: var(--muted);
	}
	.numbers {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin: 0;
	}
	.numbers div {
		padding: 2px 6px;
		background: var(--parchment);
	}
	dt {
		font-size: 0.72rem;
		font-variant-caps: small-caps;
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-weight: 700;
	}
	dd small {
		font-weight: 400;
		color: var(--muted);
	}
	.tracks {
		display: grid;
		gap: 2px;
	}
	.track {
		display: grid;
		grid-template-columns: 1.2em 1fr 1.6em;
		gap: 6px;
		align-items: center;
		font-weight: 700;
	}
	.bar {
		height: 7px;
		background: var(--parchment);
		border: 1px solid var(--rule);
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
		font-size: 0.85rem;
	}
	.outposts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		align-items: baseline;
		font-size: 0.9rem;
	}
	.label {
		font-variant-caps: small-caps;
		color: var(--blood);
		font-weight: 600;
	}
	.outposts a.supplied {
		text-decoration-color: var(--supplies);
		text-decoration-thickness: 2px;
	}
	.roster-toggle {
		justify-self: start;
		padding: 2px 8px;
		background: none;
		border: 1px solid var(--rule);
		color: var(--ink);
		font-size: 0.9rem;
	}
	.units {
		display: grid;
		gap: 4px;
	}
	.tracker {
		font-size: 0.9rem;
	}
	.muted,
	small {
		color: var(--muted);
	}
</style>
