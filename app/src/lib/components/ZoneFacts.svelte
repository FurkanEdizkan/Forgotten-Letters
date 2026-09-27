<script lang="ts">
	import Portrait from './Portrait.svelte';
	import { RESOURCE_NAMES, type Zone } from '$lib/rules/types';
	import { ARCHETYPE_NAMES } from '$lib/rules/scenario';
	import { weatherByRoll } from '$lib/rules/weather';
	import type { PublicSnapshot } from '$lib/snapshot';

	/** The facts about a zone that the map sheet and the lore page share. */
	let { zone, snapshot, compact = false }: { zone: Zone; snapshot: PublicSnapshot; compact?: boolean } = $props();

	const holders = $derived(snapshot.warbands.filter((w) => w.outposts.includes(zone.id)));
	const scouts = $derived(snapshot.warbands.filter((w) => w.scouted.includes(zone.id)));
	const region = $derived(
		snapshot.regions.find((r) => r.zones?.includes(zone.id) && r.weatherEvent) ??
			snapshot.regions.find((r) => r.zones === null && r.weatherEvent)
	);
	const regionWeather = $derived(region?.weatherEvent ? weatherByRoll(region.weatherEvent) : undefined);
</script>

<div class="facts" class:compact>
	{#if zone.resources.length}
		<p class="res">
			{#each zone.resources as r (r)}<span class="res-chip res-{r}"><span class="disc">{r}</span>{RESOURCE_NAMES[r]}</span>{/each}
		</p>
	{/if}
	{#if zone.scenario}<p>Scenario: <strong>{zone.scenario}</strong></p>{/if}
	{#if zone.archetype}<p>Random scenario · {ARCHETYPE_NAMES[zone.archetype]}</p>{/if}
	{#if zone.bonus}<p class="muted">Outpost bonus: {zone.bonus}</p>{/if}

	{#if regionWeather}
		<div class="weather">
			<strong>{region?.name ?? 'Regional weather'}:</strong> <em>{regionWeather.name}</em> — {regionWeather.effect}
			{#if region?.gamesRemaining}<br /><small>for {region.gamesRemaining} more game{region.gamesRemaining > 1 ? 's' : ''}</small>{/if}
		</div>
	{/if}

	{#if holders.length}
		<h3>Outposts</h3>
		<div class="faces">
			{#each holders as w (w.id)}
				<a href="/players/{w.id}" class="holder" class:supplied={w.supplied.includes(zone.id)} title={w.supplied.includes(zone.id) ? 'Supplied' : 'Cut off from the Entry Zone'}>
					<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={compact ? 36 : 44} />
					{#if !compact}<span>{w.player}</span>{/if}
				</a>
			{/each}
		</div>
	{/if}
	{#if scouts.length}
		<p class="muted">Scouted by {scouts.map((w) => w.player).join(', ')}</p>
	{/if}
</div>

<style>
	.facts p {
		margin: 4px 0;
	}
	h3 {
		margin: 14px 0 6px;
	}
	.res {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.res-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.92rem;
		font-weight: 600;
	}
	.disc {
		display: inline-grid;
		place-items: center;
		width: 1.45em;
		height: 1.45em;
		border-radius: 50%;
		border: 1.5px solid var(--ink);
		color: #fff;
		font-size: 0.78rem;
		font-weight: 700;
		background: var(--c);
	}
	.res-F {
		--c: var(--favour);
	}
	.res-R {
		--c: var(--relics);
	}
	.res-S {
		--c: var(--supplies);
	}
	.res-T {
		--c: var(--territories);
	}
	.weather {
		margin-top: 10px;
		padding: 8px 10px;
		border: 1px solid var(--blood);
		background: var(--paper);
	}
	.faces {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.holder {
		display: flex;
		align-items: center;
		gap: 6px;
		color: inherit;
		text-decoration: none;
		padding: 2px 8px 2px 2px;
		border: 1px solid transparent;
	}
	.holder.supplied {
		border-color: var(--supplies);
	}
	.compact .holder {
		padding: 0;
	}
	.muted,
	small {
		color: var(--muted);
	}
</style>
