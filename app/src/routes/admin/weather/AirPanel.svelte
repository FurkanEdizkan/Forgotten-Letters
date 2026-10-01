<script lang="ts">
	import { AIR_LABELS, type AirKind, type FxConfig } from '$lib/fx/types';

	/** The Aircraft tab: what flies over the map, and the crows. */
	let { fx = $bindable() }: { fx: FxConfig } = $props();
	const kinds = Object.keys(AIR_LABELS) as AirKind[];
</script>

<div class="stack">
	<fieldset class="card">
		<legend>What flies</legend>
		<div class="segs" role="radiogroup" aria-label="Aircraft mix">
			<button type="button" role="radio" aria-checked={fx.air.mode === 'war'} class="seg" class:on={fx.air.mode === 'war'} onclick={() => (fx.air.mode = 'war')}>By the war</button>
			<button type="button" role="radio" aria-checked={fx.air.mode === 'manual'} class="seg" class:on={fx.air.mode === 'manual'} onclick={() => (fx.air.mode = 'manual')}>By hand</button>
		</div>
		{#if fx.air.mode === 'war'}
			<p class="hint">
				The side ahead in the standings owns more of the sky (hellwings for the Fallen, biplanes for the Faithful), New Antioch's warbands
				bring the Papal air arm, and every battle being fought draws more aircraft.
			</p>
		{:else}
			{#each kinds as k (k)}
				<label class="line">
					<span class="what">{AIR_LABELS[k]}</span>
					<input type="range" min="0" max="5" step="0.5" bind:value={fx.air.weights[k]} />
					<span class="val">{fx.air.weights[k] === 0 ? 'never' : `×${fx.air.weights[k]}`}</span>
				</label>
			{/each}
		{/if}
	</fieldset>
	<fieldset class="card">
		<legend>How often</legend>
		<label class="line">
			<span class="what">About every</span>
			<input type="range" min="4" max="120" step="2" bind:value={fx.air.everySeconds} />
			<span class="val">{fx.air.everySeconds} s</span>
		</label>
		<label class="inline"><input type="checkbox" bind:checked={fx.air.formations} /> Biplanes sometimes fly in threes</label>
		<p class="hint">
			Crossings come now and then, sometimes two together, at different heights; lamps are lit after dusk. They fly while
			<em>Aircraft flyovers</em> is on in the Sky tab, and the crows (flocks of every size, near and far) while <em>Crows</em> is.
		</p>
	</fieldset>
</div>

<style>
	.what {
		min-width: 9rem;
		font-size: 0.9rem;
	}
</style>
