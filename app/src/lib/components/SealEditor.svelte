<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Seal from './Seal.svelte';
	import SealStudio from './SealStudio.svelte';
	import { factionColours, sealLook, type SealLook } from '$lib/seals';

	/** The player's own seal: its colours, and optionally a seal struck from their own symbol. */
	let {
		warbandId,
		faction,
		factionName,
		look
	}: { warbandId: string; faction: string; factionName: string; look: SealLook | null } = $props();

	const defaults = $derived(factionColours(faction));
	const factionLook = $derived(sealLook(faction));
	// svelte-ignore state_referenced_locally
	let metal = $state(look?.metal ?? factionColours(faction).metal);
	// svelte-ignore state_referenced_locally
	let low = $state(look?.low ?? factionColours(faction).low);
	// svelte-ignore state_referenced_locally
	let high = $state(look?.high ?? factionColours(faction).high);
	// svelte-ignore state_referenced_locally
	let usingCustom = $state(!!look?.custom);
	let struck = $state<{ base: Blob; light: Blob; source: File; urls: { base: string; light: string } } | null>(null);
	let showStudio = $state(false);
	let saving = $state(false);
	let message = $state('');

	// The strips the preview draws: freshly struck ones, else the saved seal, else the faction's.
	const strips = $derived(
		struck ? struck.urls : usingCustom && look ? { base: look.base, light: look.light } : factionLook ? { base: factionLook.base, light: factionLook.light } : null
	);
	const preview = $derived<SealLook | null>(strips ? { ...strips, metal, low, high } : null);

	function onstruck(s: { base: Blob; light: Blob; source: File }) {
		if (struck) {
			URL.revokeObjectURL(struck.urls.base);
			URL.revokeObjectURL(struck.urls.light);
		}
		struck = { ...s, urls: { base: URL.createObjectURL(s.base), light: URL.createObjectURL(s.light) } };
		usingCustom = true;
	}

	function useFaction() {
		struck = null;
		usingCustom = false;
		showStudio = false;
	}

	function resetColours() {
		({ metal, low, high } = defaults);
	}

	async function save() {
		saving = true;
		message = '';
		const body = new FormData();
		body.set('metal', metal);
		body.set('low', low);
		body.set('high', high);
		if (struck) {
			body.set('mode', 'custom');
			body.set('base', struck.base, 'base.png');
			body.set('light', struck.light, 'light.png');
			body.set('source', struck.source);
		} else if (!usingCustom) body.set('mode', 'faction');
		const res = await fetch(`/api/seal/${warbandId}`, { method: 'POST', body });
		saving = false;
		if (!res.ok) {
			message = (await res.text().catch(() => '')) || `Saving failed (${res.status}).`;
			return;
		}
		struck = null;
		showStudio = false;
		message = 'Seal saved. Every map shows it now.';
		await invalidateAll();
	}
</script>

<section class="editor rules-box">
	<h3>Your seal</h3>
	<div class="layout">
		<div class="stage">
			{#if preview}
				{#key preview.base + preview.light}<Seal look={preview} size={168} label="Your seal" />{/key}
			{:else}
				<p class="muted">Your faction has no seal on this server yet. Strike one from your own symbol.</p>
			{/if}
		</div>
		<div class="controls">
			<fieldset class="colours">
				<legend>Colours</legend>
				<label><input type="color" bind:value={metal} /> Metal</label>
				<label><input type="color" bind:value={low} /> Light at the foot</label>
				<label><input type="color" bind:value={high} /> Light at the crest</label>
				<button type="button" class="ghost" onclick={resetColours}>{factionName} colours</button>
			</fieldset>

			<fieldset>
				<legend>Symbol</legend>
				<label class="choice">
					<input type="radio" name="source" checked={!usingCustom} onchange={useFaction} disabled={!factionLook} />
					The {factionName} seal
				</label>
				<label class="choice">
					<input type="radio" name="source" checked={usingCustom} onchange={() => (showStudio = true)} />
					My own symbol
				</label>
				{#if showStudio || (usingCustom && !look)}
					<SealStudio {onstruck} />
				{:else if usingCustom}
					<button type="button" class="ghost" onclick={() => (showStudio = true)}>Strike a new one</button>
				{/if}
			</fieldset>

			<div class="actions">
				<button type="button" onclick={save} disabled={saving || !preview}>{saving ? 'Saving…' : 'Save my seal'}</button>
				{#if message}<span class="msg">{message}</span>{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.editor {
		margin-top: 24px;
	}
	.layout {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: flex-start;
	}
	.stage {
		display: grid;
		place-items: center;
		width: 200px;
		min-height: 200px;
		background: radial-gradient(circle, #2a261d, var(--night) 70%);
		border: 1px solid var(--ink);
	}
	.stage .muted {
		padding: 12px;
		color: var(--bone-dim);
		font-size: 0.9rem;
	}
	.controls {
		display: grid;
		gap: 14px;
		flex: 1;
		min-width: 16rem;
	}
	fieldset {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 10px 12px;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	legend {
		padding: 0 4px;
		font-weight: 700;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.colours label,
	.choice {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	input[type='color'] {
		width: 40px;
		height: 28px;
		padding: 0 2px;
	}
	.colours .ghost {
		justify-self: start;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.msg {
		color: var(--supplies);
	}
</style>
