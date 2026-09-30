<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { AMBIENT_KINDS, FX_LABELS, TIME_OF_DAY, type FxConfig, type FxKind, type FxLayer, type TimeOfDay } from '$lib/fx/types';

	/** The sky over the whole front: time of day, the layers running (with their tuning), and the wind. */
	let { fx = $bindable() }: { fx: FxConfig } = $props();

	const blank = (): FxLayer => ({ on: false, intensity: 0.6, speed: 1, scale: 1, opacity: 1, tint: null });
	const running = $derived(AMBIENT_KINDS.filter((k) => fx.layers[k]?.on));
	const idle = $derived(AMBIENT_KINDS.filter((k) => !fx.layers[k]?.on));
	let tuning = $state<Partial<Record<FxKind, boolean>>>({});
	const pct = (v: number | undefined) => `${Math.round((v ?? 1) * 100)}%`;

	function add(k: FxKind) {
		fx.layers[k] = { ...blank(), ...(fx.layers[k] ?? {}), on: true };
	}
	function resetTuning(k: FxKind) {
		const l = fx.layers[k]!;
		fx.layers[k] = { ...blank(), on: l.on, intensity: l.intensity };
	}
</script>

<div class="stack">
	<fieldset class="card">
		<legend>Time of day</legend>
		<div class="segs" role="radiogroup" aria-label="Time of day">
			{#each Object.entries(TIME_OF_DAY) as [k, t] (k)}
				<button type="button" role="radio" aria-checked={fx.timeOfDay === k} class="seg" class:on={fx.timeOfDay === k} onclick={() => (fx.timeOfDay = k as TimeOfDay)}>{t.label}</button>
			{/each}
		</div>
		{#if fx.timeOfDay === 'cycle'}
			<label class="inline">
				A full day takes <input type="number" min="4" max="240" step="1" bind:value={fx.cycleMinutes} class="num" /> minutes
				<small class="hint">dawn, day, dusk and night, at the same moment on every screen</small>
			</label>
		{/if}
	</fieldset>

	<fieldset class="card">
		<legend>Running now</legend>
		{#if running.length}
			<ul class="running">
				{#each running as kind (kind)}
					{@const l = fx.layers[kind]!}
					<li>
						<div class="line">
							<span class="name">{FX_LABELS[kind]}</span>
							<input type="range" min="0.05" max="1" step="0.05" bind:value={l.intensity} aria-label="{FX_LABELS[kind]} strength" />
							<span class="val">{pct(l.intensity)}</span>
							<button type="button" class="link" onclick={() => (tuning[kind] = !tuning[kind])} aria-expanded={!!tuning[kind]}>Tune</button>
							<button type="button" class="icon" aria-label="Stop {FX_LABELS[kind]}" title="Stop" onclick={() => (l.on = false)}><Mark name="close" /></button>
						</div>
						{#if tuning[kind]}
							<div class="tuning">
								<label><span class="lab">{kind === 'storm' ? 'Frequency' : 'Speed'} <span class="val">{pct(l.speed)}</span></span>
									<input type="range" min="0.25" max="3" step="0.05" bind:value={l.speed} /></label>
								<label><span class="lab">Size <span class="val">{pct(l.scale)}</span></span>
									<input type="range" min="0.5" max="2.5" step="0.05" bind:value={l.scale} /></label>
								<label><span class="lab">Opacity <span class="val">{pct(l.opacity)}</span></span>
									<input type="range" min="0" max="1" step="0.05" bind:value={l.opacity} /></label>
								<div class="inline">
									<label class="inline">Colour <input type="color" value={l.tint ?? '#ffffff'} oninput={(e) => (l.tint = e.currentTarget.value)} /></label>
									{#if l.tint}<button type="button" class="link" onclick={() => (l.tint = null)}>Natural colour</button>{/if}
									<button type="button" class="link" onclick={() => resetTuning(kind)}>Reset tuning</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">Clear skies. Add weather below.</p>
		{/if}
	</fieldset>

	<fieldset class="card">
		<legend>Add weather</legend>
		<div class="tiles">
			{#each idle as kind (kind)}
				<button type="button" class="tile" onclick={() => add(kind)}><span aria-hidden="true">+</span> {FX_LABELS[kind]}</button>
			{/each}
		</div>
	</fieldset>

	<fieldset class="card">
		<legend>Wind</legend>
		<div class="line">
			<span class="val">West</span>
			<input type="range" min="-1" max="1" step="0.05" bind:value={fx.wind} aria-label="Wind" />
			<span class="val">East</span>
			<span class="state">{fx.wind < -0.05 ? '← blowing west' : fx.wind > 0.05 ? 'blowing east →' : 'still'}</span>
		</div>
	</fieldset>
</div>

<style>
	.running {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.running li {
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	.running li:last-child {
		border-bottom: 0;
	}
	.name {
		min-width: 8.5rem;
		font-weight: 600;
	}
	.tuning {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 8px 16px;
		margin: 6px 0 4px;
		padding: 8px 10px;
		background: var(--paper);
		border-left: 2px solid var(--blood);
	}
	.tuning label {
		display: grid;
		gap: 2px;
		font-size: 0.9rem;
	}
	.lab {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.state {
		min-width: 8rem;
		color: var(--ink-soft);
	}
</style>
