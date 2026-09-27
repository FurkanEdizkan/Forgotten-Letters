<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Portrait from '$lib/components/Portrait.svelte';
	import { RESOURCE_NAMES } from '$lib/rules/types';
	import { ARCHETYPE_NAMES, randomScenario } from '$lib/rules/scenario';
	import { WEATHER, d6, weatherByRoll } from '$lib/rules/weather';

	let { data, form } = $props();

	const byId = $derived(new Map(data.warbands.map((w) => [w.id, w])));
	const zoneById = $derived(new Map(data.zones.map((z) => [z.id, z])));
	const m = $derived(data.matchup);

	function setQuery(params: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v) url.searchParams.set(k, v);
			else url.searchParams.delete(k);
		}
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// svelte-ignore state_referenced_locally
	let a = $state(data.pair?.a ?? '');
	// svelte-ignore state_referenced_locally
	let b = $state(data.pair?.b ?? '');
	let override = $state(false);
	let zone = $state('');

	const selectedZone = $derived(zone ? zoneById.get(zone) : undefined);

	// Scenario
	let deployRoll = $state(0);
	let victoryRoll = $state(0);
	const scenario = $derived.by(() => {
		if (!selectedZone) return null;
		if (selectedZone.scenario) return { name: selectedZone.scenario, random: false };
		if (!selectedZone.archetype || !deployRoll || !victoryRoll) return null;
		return randomScenario(selectedZone.archetype, deployRoll, victoryRoll, data.randomTurns);
	});

	// Hell on Earth weather: each player rolls 2D6, the one with fewer CVP picks.
	let aggRoll = $state<[number, number] | null>(null);
	let defRoll = $state<[number, number] | null>(null);
	let pick = $state<'aggressor' | 'defender' | ''>('');
	const sum = (r: [number, number] | null) => (r ? r[0] + r[1] : 0);
	let manual = $state('');
	// Regional weather covering the chosen zone is suggested as the game's weather.
	$effect(() => {
		const e = zone ? data.regionEvents[zone] : undefined;
		manual = e ? String(e) : '';
	});
	const rolled = $derived(pick === 'aggressor' ? sum(aggRoll) : pick === 'defender' ? sum(defRoll) : 0);
	const weatherEvent = $derived(manual ? Number(manual) : rolled);
	const chooserName = $derived(m?.weatherChooser ? byId.get(m.weatherChooser)?.player : null);

	function rollWeather() {
		aggRoll = [d6(), d6()];
		defRoll = [d6(), d6()];
		pick = m?.weatherChooser === m?.defender ? 'defender' : 'aggressor';
	}
	function rollScenario() {
		deployRoll = d6();
		victoryRoll = d6();
	}
</script>

<p><a href="/admin/games">← Games</a></p>
<h1>Arrange a game</h1>

<section>
	<h2>1 · The combatants</h2>
	<div class="pair">
		{#each [{ label: 'First warband', key: 'a' }, { label: 'Second warband', key: 'b' }] as side (side.key)}
			<label>
				{side.label}
				<select
					value={side.key === 'a' ? a : b}
					onchange={(e) => {
						if (side.key === 'a') a = e.currentTarget.value;
						else b = e.currentTarget.value;
						zone = '';
						setQuery({ a: a || null, b: b || null, agg: null });
					}}
				>
					<option value="">Choose…</option>
					{#each data.warbands as w (w.id)}
						<option value={w.id} disabled={w.busy || w.id === (side.key === 'a' ? b : a)}>
							{w.seat ? `P${w.seat} · ` : ''}{w.player} — {w.name} ({w.games}/{data.gamesPerPlayer}){w.busy ? ' · on the field' : w.games >= data.gamesPerPlayer ? ' · campaign done' : ''}
						</option>
					{/each}
				</select>
			</label>
		{/each}
	</div>

	{#if m}
		{@const agg = byId.get(m.aggressor)!}
		{@const def = byId.get(m.defender)!}
		<div class="versus">
			<div><Portrait name={agg.player} portrait={agg.portrait} symbol={agg.symbol} faction={agg.faction} /> <strong>{agg.player}</strong> <span class="tag">Aggressor</span></div>
			<span class="vs">vs</span>
			<div><Portrait name={def.player} portrait={def.portrait} symbol={def.symbol} faction={def.faction} /> <strong>{def.player}</strong></div>
		</div>
		<p class="muted">
			{#if m.suggested}
				{byId.get(m.suggested)?.player} has been Aggressor fewer times ({agg.aggressorCount} vs {def.aggressorCount}).
			{:else}
				Tied on Aggression ({agg.aggressorCount} each) — roll off.
			{/if}
			<button type="button" class="link" onclick={() => { zone = ''; setQuery({ agg: m.defender }); }}>Swap Aggressor</button>
		</p>
	{/if}
</section>

{#if m}
	<form method="POST">
		<input type="hidden" name="aggressor" value={m.aggressor} />
		<input type="hidden" name="defender" value={m.defender} />

		<section>
			<h2>2 · The zone</h2>
			<p class="muted">Linked to their Entry Zone, already Scouted, or linked to a Scouted zone.</p>
			<div class="zones">
				{#each m.zones.filter((o) => o.legal || override) as o (o.zone)}
					{@const z = zoneById.get(o.zone)!}
					<label class="zone" class:illegal={!o.legal} title={o.reason}>
						<input type="radio" name="zone" value={o.zone} bind:group={zone} />
						<span>
							<strong>{z.name}</strong>
							<small>
								{z.type === 'special' ? 'Special · ' : ''}{z.resources.map((r) => RESOURCE_NAMES[r]).join(', ')}
								{o.reason ? ` · ${o.reason}` : ''}
							</small>
						</span>
					</label>
				{/each}
			</div>
			<label class="check"><input type="checkbox" name="override" bind:checked={override} /> Override: show every zone</label>
		</section>

		{#if selectedZone}
			<section>
				<h2>3 · The scenario</h2>
				{#if selectedZone.scenario}
					<p><strong>{selectedZone.scenario}</strong></p>
				{:else if selectedZone.archetype}
					<p>
						Random — {ARCHETYPE_NAMES[selectedZone.archetype]}, {data.randomTurns} turns.
						<button type="button" class="ghost" onclick={rollScenario}>Roll deployment &amp; victory</button>
					</p>
					<div class="pair">
						<label>Deployment D6 <input type="number" min="1" max="6" bind:value={deployRoll} /></label>
						<label>Victory D6 <input type="number" min="1" max="6" bind:value={victoryRoll} /></label>
					</div>
					{#if scenario}<p><strong>{scenario.name}</strong></p>{/if}
				{/if}
				{#if selectedZone.bonus}<p class="muted">Zone: {selectedZone.bonus}</p>{/if}
				<input type="hidden" name="scenario" value={scenario?.name ?? ''} />
				<input type="hidden" name="scenarioRandom" value={String(!!scenario?.random)} />
			</section>

			<section>
				<h2>4 · Hell on Earth</h2>
				<p class="muted">
					Each player rolls 2D6.
					{chooserName ? `${chooserName} has fewer CVP and picks.` : 'Tied on CVP — roll off to pick.'}
					<button type="button" class="ghost" onclick={rollWeather}>Roll both</button>
				</p>
				<div class="pair">
					{#each [{ key: 'aggressor', roll: aggRoll, w: byId.get(m.aggressor) }, { key: 'defender', roll: defRoll, w: byId.get(m.defender) }] as r (r.key)}
						<label class="check weather">
							<input type="radio" value={r.key} bind:group={pick} disabled={!r.roll} />
							<span>
								{r.w?.player}: {r.roll ? `${r.roll[0]} + ${r.roll[1]} = ${sum(r.roll)}` : '—'}
								{#if r.roll}<br /><strong>{weatherByRoll(sum(r.roll))?.name}</strong>{/if}
							</span>
						</label>
					{/each}
				</div>
				<label>
					{zone && data.regionEvents[zone] ? 'Regional weather applies here — or override' : 'Or set it directly (regional weather, CM ruling)'}
					<select bind:value={manual}>
						<option value="">Use the roll</option>
						{#each WEATHER as w (w.roll)}<option value={String(w.roll)}>{w.roll} · {w.name}</option>{/each}
					</select>
				</label>
				{#if weatherEvent}
					<p><strong>{weatherByRoll(weatherEvent)?.name}:</strong> {weatherByRoll(weatherEvent)?.effect}</p>
				{/if}
				<input type="hidden" name="weatherEvent" value={weatherEvent || ''} />
				<input type="hidden" name="weatherRolls" value={JSON.stringify({ aggressor: aggRoll, defender: defRoll, pick, manual: !!manual })} />
			</section>

			<button>Start the game</button>
		{/if}
		{#if form?.message}<p class="error">{form.message}</p>{/if}
	</form>
{/if}

<style>
	section {
		margin: 16px 0;
		padding: 14px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	h2 {
		margin: 0 0 8px;
		font-size: 1.6rem;
	}
	.pair {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 12px;
	}
	label {
		display: grid;
		gap: 4px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.versus {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
		margin-top: 14px;
	}
	.versus > div {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.vs {
		font-family: var(--font-display);
		font-size: 1.6rem;
		color: var(--blood);
	}
	.tag {
		font-variant-caps: small-caps;
		color: var(--blood);
	}
	.zones {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 6px;
		margin-bottom: 10px;
	}
	.zone {
		display: flex;
		gap: 8px;
		align-items: baseline;
		padding: 6px 8px;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
	}
	.zone:has(input:checked) {
		border-color: var(--blood);
		box-shadow: inset 0 0 0 1px var(--blood);
	}
	.zone span {
		display: grid;
	}
	.illegal {
		opacity: 0.6;
	}
	small,
	.muted {
		color: var(--muted);
	}
	.link {
		background: none;
		border: none;
		color: var(--blood);
		text-decoration: underline;
		padding: 0 4px;
		font-variant-caps: normal;
	}
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
		padding: 3px 10px;
	}
	.weather {
		padding: 6px 8px;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.error {
		color: var(--blood);
	}
</style>
