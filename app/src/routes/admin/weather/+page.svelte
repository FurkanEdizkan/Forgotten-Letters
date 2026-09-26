<script lang="ts">
	import { enhance } from '$app/forms';
	import { AMBIENT_KINDS, FX_LABELS, TRIGGER_LABELS, type FxConfig, type TriggerKind } from '$lib/fx/types';
	import { WEATHER, weatherByRoll } from '$lib/rules/weather';

	let { data, form } = $props();

	// Every ambient layer gets an entry up front, so the template never mutates state.
	function withLayers(c: FxConfig): FxConfig {
		const copy = structuredClone(c);
		for (const k of AMBIENT_KINDS) copy.layers[k] ??= { on: false, intensity: 0.6 };
		return copy;
	}
	// svelte-ignore state_referenced_locally
	let fx = $state<FxConfig>(withLayers(data.fx));
	let saved = $state<'idle' | 'saving' | 'live'>('idle');

	// Push every change to the server; viewers update within a second.
	let first = true;
	$effect(() => {
		const body = JSON.stringify(fx);
		if (first) {
			first = false;
			return;
		}
		saved = 'saving';
		const t = setTimeout(async () => {
			const res = await fetch('/admin/weather/fx', { method: 'POST', body });
			saved = res.ok ? 'live' : 'idle';
		}, 200);
		return () => clearTimeout(t);
	});

	function allOff() {
		for (const k of Object.keys(fx.layers)) fx.layers[k as keyof typeof fx.layers]!.on = false;
	}
	function toggleRandom(kind: TriggerKind) {
		fx.random.kinds = fx.random.kinds.includes(kind) ? fx.random.kinds.filter((k) => k !== kind) : [...fx.random.kinds, kind];
	}

	let triggerZone = $state('');
	let wholeMap = $state(false);
	const zoneName = (id: string) => data.zones.find((z) => z.id === id)?.name ?? id;
	const battleZones = $derived(data.zones.filter((z) => z.type !== 'entry'));
	const PRESETS: Record<string, string[]> = {
		'The coast': ['E', 'B', 'amoudet-seawall', 'altar-of-leviathan', 'carrion-coast', 'pillar-of-jonah', 'sword-of-god', 'risen-ruins'],
		'The Amanus front': ['north-amanus-trenches', 'south-amanus-trenches', 'holy-choked-path', 'desolate-trapesac', 'syrian-gate'],
		'The east': ['kurd-dagh', 'kyrrhos-city', 'stylite-row', 'basarfuth-castle', 'ruins-of-nineveh-novus', 'scavenger-town', 'F']
	};
	let picked = $state<string[]>([]);
</script>

<div class="top">
	<h1>Weather &amp; Omens</h1>
	<span class="status status-{saved}">{saved === 'saving' ? 'Sending…' : saved === 'live' ? 'Live on every map' : ''}</span>
</div>

<section>
	<div class="row-head">
		<h2>Across the front</h2>
		<button type="button" class="ghost" onclick={allOff}>Clear skies</button>
	</div>
	<div class="layers">
		{#each AMBIENT_KINDS as kind (kind)}
			<div class="layer" class:on={fx.layers[kind]!.on}>
				<label class="check"><input type="checkbox" bind:checked={fx.layers[kind]!.on} /> {FX_LABELS[kind]}</label>
				<input type="range" min="0.1" max="1" step="0.05" bind:value={fx.layers[kind]!.intensity} disabled={!fx.layers[kind]!.on} aria-label="{FX_LABELS[kind]} intensity" />
			</div>
		{/each}
	</div>
	<div class="controls">
		<label>
			Wind {fx.wind < -0.05 ? '← west' : fx.wind > 0.05 ? 'east →' : 'still'}
			<input type="range" min="-1" max="1" step="0.05" bind:value={fx.wind} />
		</label>
		<label>
			Quality cap
			<select bind:value={fx.quality}>
				<option value="low">Low (old phones)</option>
				<option value="medium">Medium</option>
				<option value="high">High</option>
			</select>
		</label>
		<label class="check">
			<input type="checkbox" bind:checked={fx.battleWeather} /> Show each battle's Hell on Earth weather at its zone
		</label>
	</div>
</section>

<section>
	<h2>Portents</h2>
	<p class="muted">Strike now — every map plays it at once.</p>
	<form method="POST" action="?/trigger" use:enhance={() => ({ update }) => update({ reset: false })} class="triggers">
		<label>
			Where
			<select name="zone" bind:value={triggerZone}>
				<option value="">Anywhere</option>
				{#each data.zones as z (z.id)}<option value={z.id}>{z.name}</option>{/each}
			</select>
		</label>
		{#each Object.entries(TRIGGER_LABELS) as [kind, label] (kind)}
			<button name="kind" value={kind}>{label}</button>
		{/each}
	</form>
	<div class="random">
		<label class="check"><input type="checkbox" bind:checked={fx.random.on} /> Random portents, about every</label>
		<input type="number" min="5" max="600" bind:value={fx.random.everySeconds} /> seconds:
		{#each Object.entries(TRIGGER_LABELS) as [kind, label] (kind)}
			<label class="check">
				<input type="checkbox" checked={fx.random.kinds.includes(kind as TriggerKind)} onchange={() => toggleRandom(kind as TriggerKind)} />
				{label}
			</label>
		{/each}
	</div>
</section>

<section>
	<h2>Regional weather</h2>
	<p class="muted">
		A Hell on Earth event over part of the front. It shows on the map and is suggested as the weather for games played there.
	</p>
	<form method="POST" action="?/addRegion" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') picked = []; }} class="region-form">
		<div class="line">
			<label>Name <input name="name" placeholder="e.g. The Red Tide" /></label>
			<label>
				Event
				<select name="weatherEvent" required>
					<option value="">Choose…</option>
					{#each WEATHER as w (w.roll)}<option value={w.roll}>{w.roll} · {w.name}</option>{/each}
				</select>
			</label>
			<label>Lasts (games in the region) <input name="gamesRemaining" type="number" min="1" placeholder="until cleared" /></label>
		</div>
		<label class="check"><input type="checkbox" name="wholeMap" bind:checked={wholeMap} /> The whole map</label>
		{#if !wholeMap}
			<div class="presets">
				{#each Object.entries(PRESETS) as [name, zones] (name)}
					<button type="button" class="ghost" onclick={() => (picked = [...new Set([...picked, ...zones])])}>+ {name}</button>
				{/each}
				<button type="button" class="ghost" onclick={() => (picked = [])}>Clear</button>
			</div>
			<div class="zones">
				{#each [...data.zones.filter((z) => z.type === 'entry'), ...battleZones] as z (z.id)}
					<label class="check"><input type="checkbox" name="zones" value={z.id} bind:group={picked} /> {z.name}</label>
				{/each}
			</div>
		{/if}
		<button>Set the weather</button>
		{#if form && 'regionMessage' in form}<span class="error">{form.regionMessage}</span>{/if}
	</form>

	<ul class="regions">
		{#each data.regions as r (r.id)}
			{@const w = r.weatherEvent ? weatherByRoll(r.weatherEvent) : null}
			<li class:inactive={!r.active}>
				<span>
					<strong>{r.name ?? w?.name}</strong>{r.name ? ` · ${w?.name}` : ''}
					<small>
						{r.zones ? r.zones.map(zoneName).join(', ') : 'Whole map'}
						{r.gamesRemaining !== null ? ` · ${r.gamesRemaining} game${r.gamesRemaining === 1 ? '' : 's'} left` : ''}
					</small>
				</span>
				<span class="actions">
					<form method="POST" action="?/toggleRegion" use:enhance>
						<input type="hidden" name="id" value={r.id} />
						<button class="ghost">{r.active ? 'Lift' : 'Restore'}</button>
					</form>
					<form method="POST" action="?/deleteRegion" use:enhance>
						<input type="hidden" name="id" value={r.id} />
						<button class="ghost">Delete</button>
					</form>
				</span>
			</li>
		{:else}
			<li class="muted"><em>No regional weather.</em></li>
		{/each}
	</ul>
</section>

<style>
	.top {
		display: flex;
		align-items: baseline;
		gap: 16px;
	}
	.status {
		color: var(--muted);
	}
	.status-live {
		color: var(--supplies);
	}
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
	.row-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.layers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 8px;
	}
	.layer {
		display: grid;
		gap: 4px;
		padding: 8px 10px;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.layer.on {
		border-color: var(--blood);
		box-shadow: inset 0 0 0 1px var(--blood);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 24px;
		margin-top: 14px;
		align-items: end;
	}
	label {
		display: grid;
		gap: 4px;
	}
	.check {
		display: flex;
		gap: 6px;
		align-items: baseline;
	}
	.triggers,
	.random,
	.presets,
	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: end;
	}
	.random {
		margin-top: 12px;
		align-items: baseline;
	}
	.random input[type='number'] {
		width: 5em;
	}
	.region-form {
		display: grid;
		gap: 10px;
		justify-items: start;
	}
	.zones {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 2px 12px;
		width: 100%;
	}
	.regions {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
		margin-top: 14px;
	}
	.regions li {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
		padding: 6px 12px;
		background: var(--paper);
		border: 1px solid var(--rule);
	}
	.regions li > span:first-child {
		display: grid;
	}
	.regions .inactive {
		opacity: 0.55;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
		padding: 3px 10px;
	}
	small,
	.muted {
		color: var(--muted);
	}
	.error {
		color: var(--blood);
	}
</style>
