<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { enhance } from '$app/forms';
	import LiveMap from '$lib/components/LiveMap.svelte';
	import {
		AMBIENT_KINDS,
		FX_LABELS,
		TIME_OF_DAY,
		TRIGGER_LABELS,
		type FxConfig,
		type FxKind,
		type FxLayer,
		type TimeOfDay,
		type TriggerKind
	} from '$lib/fx/types';
	import { WEATHER, weatherByRoll } from '$lib/rules/weather';

	let { data, form } = $props();

	const blank = (): FxLayer => ({ on: false, intensity: 0.6, speed: 1, scale: 1, opacity: 1, tint: null });

	// Every ambient layer gets an entry up front, so the template never mutates state.
	function withLayers(c: FxConfig): FxConfig {
		const copy = structuredClone(c);
		for (const k of AMBIENT_KINDS) copy.layers[k] = { ...blank(), ...(copy.layers[k] ?? {}) };
		return copy;
	}
	// svelte-ignore state_referenced_locally
	let fx = $state<FxConfig>(withLayers(data.fx));
	let saved = $state<'idle' | 'saving' | 'live'>('idle');
	let tuning = $state<Partial<Record<FxKind, boolean>>>({});

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
		}, 250);
		return () => clearTimeout(t);
	});

	// The preview map shows this console's settings immediately. $state.snapshot reads the config
	// deeply, so tuning a layer re-runs this; spreading `fx` alone would only read the reference,
	// leaving the preview on the settings the page loaded with.
	const preview = $derived({ ...data.snapshot, fx: $state.snapshot(fx) as FxConfig });

	function allOff() {
		for (const k of AMBIENT_KINDS) fx.layers[k]!.on = false;
	}
	function resetTuning(k: FxKind) {
		const l = fx.layers[k]!;
		fx.layers[k] = { ...blank(), on: l.on, intensity: l.intensity };
	}
	function toggleRandom(kind: TriggerKind) {
		fx.random.kinds = fx.random.kinds.includes(kind) ? fx.random.kinds.filter((k) => k !== kind) : [...fx.random.kinds, kind];
	}

	// Presets
	let presetName = $state('');
	function savePreset() {
		const name = presetName.trim();
		if (!name) return;
		const snapshot = { name, layers: structuredClone($state.snapshot(fx.layers)), wind: fx.wind, timeOfDay: fx.timeOfDay };
		fx.presets = [...fx.presets.filter((p) => p.name !== name), snapshot];
		presetName = '';
	}
	function applyPreset(i: number) {
		const p = fx.presets[i];
		const layers = structuredClone($state.snapshot(p.layers));
		for (const k of AMBIENT_KINDS) fx.layers[k] = { ...blank(), ...(layers[k] ?? {}) };
		fx.wind = p.wind;
		fx.timeOfDay = p.timeOfDay;
	}
	const pct = (v: number | undefined) => `${Math.round((v ?? 1) * 100)}%`;

	// Regional weather
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
	let regionKinds = $state<FxKind[]>([]);
	let regionIntensity = $state(0.7);
	const regionLayers = $derived(
		Object.fromEntries(regionKinds.map((k) => [k, { ...blank(), on: true, intensity: regionIntensity }]))
	);
</script>

<div class="top">
	<h1>Weather &amp; Omens</h1>
	<span class="status status-{saved}">{saved === 'saving' ? 'Sending…' : saved === 'live' ? 'Live on every map' : ''}</span>
</div>

<div class="split">
	<div class="controls-col">
		<section>
			<div class="row-head">
				<h2>Across the front</h2>
				<button type="button" class="ghost" onclick={allOff}>Clear skies</button>
			</div>

			<div class="tod">
				{#each Object.entries(TIME_OF_DAY) as [k, t] (k)}
					<button type="button" class="seg" class:on={fx.timeOfDay === k} onclick={() => (fx.timeOfDay = k as TimeOfDay)}>{t.label}</button>
				{/each}
			</div>
			{#if fx.timeOfDay === 'cycle'}
				<label class="cycle">
					A full day takes <input type="number" min="4" max="240" step="1" bind:value={fx.cycleMinutes} /> minutes
					<small>(day, dusk, night and dawn; the same moment on every screen)</small>
				</label>
			{/if}

			<div class="layers">
				{#each AMBIENT_KINDS as kind (kind)}
					{@const l = fx.layers[kind]!}
					<div class="layer" class:on={l.on}>
						<div class="lhead">
							<label class="check"><input type="checkbox" bind:checked={l.on} /> {FX_LABELS[kind]}</label>
							<button type="button" class="tune" onclick={() => (tuning[kind] = !tuning[kind])} aria-expanded={!!tuning[kind]}>{tuning[kind] ? '▾' : '▸'} tune</button>
						</div>
						<input type="range" min="0.05" max="1" step="0.05" bind:value={l.intensity} disabled={!l.on} aria-label="{FX_LABELS[kind]} strength" />
						{#if tuning[kind]}
							<div class="tuning">
								<label>{kind.includes('torm') ? 'Frequency' : 'Speed'} <small>{pct(l.speed)}</small>
									<input type="range" min="0.25" max="3" step="0.05" bind:value={l.speed} /></label>
								<label>Size <small>{pct(l.scale)}</small>
									<input type="range" min="0.5" max="2.5" step="0.05" bind:value={l.scale} /></label>
								<label>Opacity <small>{pct(l.opacity)}</small>
									<input type="range" min="0" max="1" step="0.05" bind:value={l.opacity} /></label>
								<div class="colour">
									<label>Colour <input type="color" value={l.tint ?? '#ffffff'} oninput={(e) => (l.tint = e.currentTarget.value)} /></label>
									{#if l.tint}<button type="button" class="link" onclick={() => (l.tint = null)}>natural</button>{/if}
									<button type="button" class="link" onclick={() => resetTuning(kind)}>reset</button>
								</div>
							</div>
						{/if}
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
				<label class="check"><input type="checkbox" bind:checked={fx.battleWeather} /> Show each battle's Hell on Earth weather at its zone</label>
				<label class="check"><input type="checkbox" bind:checked={fx.monuments} /> Leave victory monuments and the fallen on the zones where battles were won</label>
			</div>
		</section>

		<section>
			<h2>Presets</h2>
			<div class="presets-list">
				{#each fx.presets as p, i (p.name)}
					<span class="preset">
						<button type="button" class="ghost" onclick={() => applyPreset(i)} title="Apply">{p.name}</button>
						<button type="button" class="x" aria-label="Delete {p.name}" onclick={() => (fx.presets = fx.presets.filter((_, j) => j !== i))}><Mark name="close" /></button>
					</span>
				{:else}
					<span class="muted">No presets yet.</span>
				{/each}
			</div>
			<div class="row">
				<input bind:value={presetName} placeholder="Name this sky, e.g. The Red Tide" />
				<button type="button" onclick={savePreset} disabled={!presetName.trim()}>Save current</button>
			</div>
		</section>
	</div>

	<aside class="preview">
		<div class="preview-map"><LiveMap snapshot={preview} /></div>
		<small class="muted">Preview — the same map every viewer sees.</small>
	</aside>
</div>

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
	<form method="POST" action="?/zeppelin" use:enhance={() => ({ update }) => update({ reset: false })} class="zeppelin">
		<h3>Special event · Zeppelin</h3>
		<div class="line">
			<label class="wide">Banner text <input name="text" placeholder="The Iron Sultanate's airship passes over the Vivarium" /></label>
			<label>
				Route over
				<select name="via">
					<option value="">Anywhere</option>
					{#each data.zones as z (z.id)}<option value={z.id}>{z.name}</option>{/each}
				</select>
			</label>
			<label>Crossing (s) <input name="seconds" type="number" min="15" max="180" value="45" /></label>
			<label class="check"><input type="checkbox" name="bomb" /> Bomb that zone</label>
			<button>Launch the zeppelin</button>
		</div>
		{#if form && 'zeppelin' in form}<span class="ok">Aloft on every map.</span>{/if}
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
		Weather over part of the front: a Hell on Earth event (suggested for games played there) and/or its own weather layers.
	</p>
	<form
		method="POST"
		action="?/addRegion"
		use:enhance={() =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') {
					picked = [];
					regionKinds = [];
				}
			}}
		class="region-form"
	>
		<div class="line">
			<label>Name <input name="name" placeholder="e.g. The Red Tide" /></label>
			<label>
				Hell on Earth event
				<select name="weatherEvent">
					<option value="">None</option>
					{#each WEATHER as w (w.roll)}<option value={w.roll}>{w.roll} · {w.name}</option>{/each}
				</select>
			</label>
			<label>Lasts (games in the region) <input name="gamesRemaining" type="number" min="1" placeholder="until cleared" /></label>
		</div>
		<fieldset>
			<legend>Weather layers for this region</legend>
			<div class="kinds">
				{#each AMBIENT_KINDS as k (k)}
					<label class="check"><input type="checkbox" value={k} bind:group={regionKinds} /> {FX_LABELS[k]}</label>
				{/each}
			</div>
			<label>Strength <input type="range" min="0.1" max="1" step="0.05" bind:value={regionIntensity} /></label>
		</fieldset>
		<input type="hidden" name="layers" value={JSON.stringify(regionLayers)} />
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
			{@const kinds = Object.entries(r.layers).filter(([, l]) => l?.on).map(([k]) => FX_LABELS[k as FxKind])}
			<li class:inactive={!r.active}>
				<span>
					<strong>{r.name ?? w?.name ?? kinds.join(', ')}</strong>{r.name && w ? ` · ${w.name}` : ''}
					<small>
						{r.zones ? r.zones.map(zoneName).join(', ') : 'Whole map'}
						{kinds.length ? ` · ${kinds.join(', ')}` : ''}
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
	.split {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 56rem) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.preview {
		position: sticky;
		top: 12px;
		margin: 16px 0;
	}
	.preview-map {
		position: relative;
		aspect-ratio: 2398 / 1604;
		border: 1px solid var(--ink);
		overflow: hidden;
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
	.tod {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		margin-bottom: 10px;
	}
	.cycle {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		margin: -4px 0 12px;
		font-size: 0.9rem;
	}
	.cycle input {
		width: 5rem;
	}
	.cycle small {
		color: var(--muted);
	}
	.seg {
		background: var(--paper);
		color: var(--ink);
		border-color: var(--rule);
		border-radius: 0;
	}
	.seg.on {
		background: var(--ink);
		color: var(--parchment);
	}
	.layers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 8px;
	}
	.layer {
		display: grid;
		gap: 4px;
		padding: 8px 10px;
		border: 1px solid var(--rule);
		background: var(--paper);
		align-content: start;
	}
	.layer.on {
		border-color: var(--blood);
		box-shadow: inset 0 0 0 1px var(--blood);
	}
	.lhead {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px;
	}
	.tune,
	.link {
		padding: 0 4px;
		background: none;
		border: none;
		color: var(--blood);
		font-size: 0.85rem;
		font-variant-caps: normal;
		letter-spacing: 0;
	}
	.link {
		text-decoration: underline;
	}
	.tuning {
		display: grid;
		gap: 4px;
		padding-top: 4px;
		border-top: 1px dotted var(--rule);
	}
	.tuning small {
		color: var(--muted);
	}
	.colour {
		display: flex;
		gap: 8px;
		align-items: end;
	}
	.colour input[type='color'] {
		width: 3rem;
		height: 1.8rem;
		padding: 0;
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
	.presets-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}
	.preset {
		display: inline-flex;
	}
	.x {
		padding: 2px 8px;
		background: transparent;
		color: var(--blood);
		border: 1px solid var(--rule);
		border-left: none;
	}
	.row,
	.triggers,
	.random,
	.presets,
	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: end;
	}
	.zeppelin {
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px dotted var(--rule);
	}
	.zeppelin h3 {
		margin: 0 0 6px;
		font-variant-caps: small-caps;
		color: var(--blood);
	}
	.wide {
		flex: 1;
		min-width: 16rem;
	}
	.ok {
		color: var(--supplies);
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
	fieldset {
		display: grid;
		gap: 8px;
		width: 100%;
		border: 1px solid var(--rule);
	}
	legend {
		color: var(--muted);
	}
	.kinds,
	.zones {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
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
