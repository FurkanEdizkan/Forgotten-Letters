<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { AMBIENT_KINDS, type FxConfig, type FxLayer } from '$lib/fx/types';

	/** The Display and Presets tabs: how the map renders for everyone, and saved skies. */
	let { fx = $bindable(), show }: { fx: FxConfig; show: 'display' | 'presets' } = $props();

	const blank = (): FxLayer => ({ on: false, intensity: 0.6, speed: 1, scale: 1, opacity: 1, tint: null });
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
</script>

{#if show === 'display'}
	<div class="stack">
		<fieldset class="card">
			<legend>Quality</legend>
			<label class="inline">
				Highest quality any screen may use
				<select bind:value={fx.quality}>
					<option value="low">Low (old phones)</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
			</label>
			<p class="hint">Each device can still lower it for itself.</p>
		</fieldset>
		<fieldset class="card">
			<legend>On the zones</legend>
			<label class="switch"><input type="checkbox" role="switch" bind:checked={fx.battleWeather} /> <span>Each battle's Hell on Earth weather over its zone</span></label>
			<label class="switch"><input type="checkbox" role="switch" bind:checked={fx.monuments} /> <span>Victory monuments and the fallen where battles were won</span></label>
		</fieldset>
	</div>
{:else}
	<div class="stack">
		<fieldset class="card">
			<legend>Saved skies</legend>
			{#if fx.presets.length}
				<ul class="presets">
					{#each fx.presets as p, i (p.name)}
						<li>
							<button type="button" class="tile" onclick={() => applyPreset(i)}>{p.name}</button>
							<button type="button" class="icon" aria-label="Delete {p.name}" title="Delete" onclick={() => (fx.presets = fx.presets.filter((_, j) => j !== i))}><Mark name="close" /></button>
						</li>
					{/each}
				</ul>
				<p class="hint">Applying one sets the layers, the wind and the time of day.</p>
			{:else}
				<p class="hint">No saved skies yet.</p>
			{/if}
		</fieldset>
		<fieldset class="card">
			<legend>Save the current sky</legend>
			<form class="inline" onsubmit={(e) => { e.preventDefault(); savePreset(); }}>
				<input bind:value={presetName} placeholder="e.g. The Red Tide" aria-label="Name" />
				<button disabled={!presetName.trim()}>Save</button>
			</form>
		</fieldset>
	</div>
{/if}

<style>
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.presets li {
		display: inline-flex;
		align-items: center;
	}
</style>
