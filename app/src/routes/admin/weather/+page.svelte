<script lang="ts">
	import LiveMap from '$lib/components/LiveMap.svelte';
	import { AMBIENT_KINDS, type FxConfig, type FxLayer } from '$lib/fx/types';
	import { weatherNow } from '$lib/fx/summary';
	import SkyPanel from './SkyPanel.svelte';
	import PortentsPanel from './PortentsPanel.svelte';
	import RegionsPanel from './RegionsPanel.svelte';
	import SettingsPanels from './SettingsPanels.svelte';

	let { data, form } = $props();

	const blank = (): FxLayer => ({ on: false, intensity: 0.6, speed: 1, scale: 1, opacity: 1, tint: null });
	// Every ambient layer gets an entry up front, so the panels never have to create one mid-render.
	function withLayers(c: FxConfig): FxConfig {
		const copy = structuredClone(c);
		for (const k of AMBIENT_KINDS) copy.layers[k] = { ...blank(), ...(copy.layers[k] ?? {}) };
		return copy;
	}
	// svelte-ignore state_referenced_locally
	let fx = $state<FxConfig>(withLayers(data.fx));
	let saved = $state<'idle' | 'saving' | 'live' | 'failed'>('idle');

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
			const res = await fetch('/admin/weather/fx', { method: 'POST', body }).catch(() => null);
			saved = res?.ok ? 'live' : 'failed';
		}, 250);
		return () => clearTimeout(t);
	});

	// The preview shows this console's settings at once. $state.snapshot reads the config deeply, so tuning a
	// layer re-runs this; spreading `fx` alone would only read the reference.
	const preview = $derived({ ...data.snapshot, fx: $state.snapshot(fx) as FxConfig });
	const now = $derived(weatherNow($state.snapshot(fx) as FxConfig, data.regions));

	function clearSkies() {
		for (const k of AMBIENT_KINDS) fx.layers[k]!.on = false;
	}

	const TABS = [
		{ id: 'sky', label: 'Sky' },
		{ id: 'portents', label: 'Portents' },
		{ id: 'regions', label: 'Regions' },
		{ id: 'display', label: 'Display' },
		{ id: 'presets', label: 'Presets' }
	] as const;
	type Tab = (typeof TABS)[number]['id'];
	let tab = $state<Tab>('sky');
	$effect(() => {
		try {
			const t = localStorage.getItem('cf-wx-tab');
			if (TABS.some((x) => x.id === t)) tab = t as Tab;
		} catch {
			/* storage unavailable */
		}
	});
	function choose(t: Tab) {
		tab = t;
		if (t !== 'regions') picking = false;
		try {
			localStorage.setItem('cf-wx-tab', t);
		} catch {
			/* storage unavailable */
		}
	}
	function tabKeys(e: KeyboardEvent) {
		const i = TABS.findIndex((t) => t.id === tab);
		const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
		if (next === null) return;
		e.preventDefault();
		const t = TABS[(next + TABS.length) % TABS.length];
		choose(t.id);
		document.getElementById(`wx-tab-${t.id}`)?.focus();
	}

	// Regions: zones picked for a new region, and whether clicks on the preview map pick them.
	let picked = $state<string[]>([]);
	let picking = $state(false);
	function mapZone(id: string) {
		if (!picking) return;
		picked = picked.includes(id) ? picked.filter((z) => z !== id) : [...picked, id];
	}
</script>

<svelte:head><title>Weather · Admin</title></svelte:head>

<header class="top">
	<h1>Weather &amp; Omens</h1>
	<span class="status status-{saved}" role="status">
		<span class="dot" aria-hidden="true"></span>
		{saved === 'saving' ? 'Sending…' : saved === 'failed' ? 'Not sent — check the connection' : 'Live on every map'}
	</span>
</header>

<div class="console">
	<div class="stage">
		<div class="preview" class:picking>
			<div class="preview-map"><LiveMap snapshot={preview} onzone={mapZone} /></div>
			{#if picking}<p class="pick-note">Click zones to add or remove them · {picked.length} picked</p>{/if}
		</div>
		<div class="now">
			<p class="now-line">
				<strong>Now:</strong>
				{now.time} ·
				{now.layers.length ? now.layers.join(', ') : 'clear skies'} ·
				{now.wind}{now.random ? ` · ${now.random}` : ''}
			</p>
			{#if now.regions.length}<p class="now-regions">Regions: {now.regions.join('; ')}</p>{/if}
			<button type="button" class="ghost small" onclick={clearSkies} disabled={!now.layers.length}>Clear skies</button>
		</div>
	</div>

	<div class="controls">
		<div class="tabs" role="tablist" aria-label="Weather console" tabindex="-1" onkeydown={tabKeys}>
			{#each TABS as t (t.id)}
				<button
					type="button"
					role="tab"
					id="wx-tab-{t.id}"
					aria-selected={tab === t.id}
					aria-controls="wx-panel"
					tabindex={tab === t.id ? 0 : -1}
					onclick={() => choose(t.id)}>{t.label}</button
				>
			{/each}
		</div>
		<div id="wx-panel" role="tabpanel" aria-labelledby="wx-tab-{tab}">
			{#if tab === 'sky'}
				<SkyPanel bind:fx />
			{:else if tab === 'portents'}
				<PortentsPanel bind:fx zones={data.zones} {form} />
			{:else if tab === 'regions'}
				<RegionsPanel regions={data.regions} zones={data.zones} {form} bind:picked bind:picking />
			{:else}
				<SettingsPanels bind:fx show={tab} />
			{/if}
		</div>
	</div>
</div>

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px 16px;
	}
	h1 {
		margin: 0;
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 3px 10px;
		border: 1px solid var(--rule);
		font-size: 0.9rem;
		color: var(--ink-soft);
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--supplies);
	}
	.status-saving .dot {
		background: var(--favour);
	}
	.status-failed {
		color: var(--blood);
		border-color: var(--blood);
	}
	.status-failed .dot {
		background: var(--blood);
	}

	/* The preview and what it shows on the left, the console on the right. */
	.console {
		display: grid;
		grid-template-columns: minmax(0, 11fr) minmax(0, 9fr);
		gap: 20px;
		align-items: start;
		margin-top: 16px;
	}
	.stage {
		position: sticky;
		top: 12px;
		display: grid;
		gap: 10px;
	}
	.preview {
		position: relative;
	}
	.preview-map {
		position: relative;
		aspect-ratio: 2398 / 1604;
		border: 1px solid var(--ink);
		overflow: hidden;
	}
	.preview.picking .preview-map {
		outline: 3px solid var(--blood);
		outline-offset: 2px;
		cursor: crosshair;
	}
	.pick-note {
		position: absolute;
		left: 8px;
		bottom: 8px;
		margin: 0;
		padding: 4px 10px;
		background: rgba(21, 19, 14, 0.88);
		color: var(--bone);
		font-size: 0.85rem;
		pointer-events: none;
	}
	.now {
		display: grid;
		gap: 4px;
		justify-items: start;
		padding: 10px 12px;
		border-top: 2px solid var(--ink);
		background: var(--parchment);
	}
	.now p {
		margin: 0;
	}
	.now-regions {
		color: var(--ink-soft);
		font-size: 0.92rem;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		border-bottom: 2px solid var(--ink);
	}
	.tabs button {
		margin-bottom: -2px;
		padding: 7px 10px 5px;
		background: none;
		color: var(--ink-soft);
		border: 0;
		border-bottom: 2px solid transparent;
		font-family: var(--font-title);
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.tabs button:hover {
		color: var(--ink);
	}
	.tabs button[aria-selected='true'] {
		color: var(--ink);
		border-bottom-color: var(--blood);
	}
	#wx-panel {
		padding-top: 14px;
	}

	/* Shared by every panel. */
	.console :global(.stack) {
		display: grid;
		gap: 12px;
	}
	.console :global(.card) {
		margin: 0;
		padding: 12px 14px;
		border: 1px solid var(--rule);
		background: var(--parchment);
		min-width: 0;
	}
	.console :global(.card fieldset) {
		border: 0;
		padding: 0;
		margin-inline: 0;
		min-width: 0;
	}
	.console :global(legend) {
		padding: 0;
		margin-bottom: 8px;
		font-family: var(--font-title);
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--blood);
	}
	.console :global(.hint) {
		margin: 6px 0 0;
		font-size: 0.88rem;
		color: var(--muted);
	}
	.console :global(.inline) {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		margin-top: 6px;
	}
	.console :global(.line) {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.console :global(.line input[type='range']) {
		flex: 1;
		min-width: 6rem;
	}
	.console :global(.val) {
		min-width: 3ch;
		font-size: 0.85rem;
		color: var(--ink-soft);
		font-variant-numeric: lining-nums tabular-nums;
	}
	.console :global(.num) {
		width: 5rem;
	}
	.console :global(.segs) {
		display: flex;
		flex-wrap: wrap;
	}
	.console :global(.seg) {
		padding: 5px 12px;
		font-size: 0.85rem;
		background: var(--paper);
		color: var(--ink);
		border: 1px solid var(--rule);
		margin: 0 -1px -1px 0;
	}
	.console :global(.seg.on) {
		background: var(--ink);
		color: var(--parchment);
		border-color: var(--ink);
	}
	.console :global(.tiles) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 6px;
	}
	.console :global(.tile) {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 6px;
		padding: 7px 10px;
		background: var(--paper);
		color: var(--ink);
		border: 1px solid var(--rule);
		font-family: var(--font-body);
		font-size: 0.95rem;
		letter-spacing: 0;
		text-transform: none;
		text-align: left;
	}
	.console :global(.tile:hover) {
		border-color: var(--ink);
		background: var(--paper);
		color: var(--ink);
	}
	.console :global(.tile[aria-pressed='true']) {
		background: var(--ink);
		color: var(--parchment);
		border-color: var(--ink);
	}
	.console :global(.switch) {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 4px 0;
	}
	.console :global(.icon) {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: none;
		color: var(--ink-soft);
		border: 1px solid transparent;
	}
	.console :global(.icon:hover) {
		background: none;
		color: var(--blood);
		border-color: var(--rule);
	}
	.console :global(.link) {
		padding: 0;
		background: none;
		border: 0;
		color: var(--blood);
		font-family: var(--font-body);
		font-size: 0.9rem;
		letter-spacing: 0;
		text-transform: none;
		text-decoration: underline;
	}
	.console :global(.link:hover) {
		background: none;
		color: var(--ink);
	}

	@media (max-width: 56rem) {
		.console {
			grid-template-columns: 1fr;
		}
		.stage {
			position: static;
		}
	}
</style>
