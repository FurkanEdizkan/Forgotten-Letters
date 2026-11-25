<!--
  The Owner's copy-wide settings: text size and accent, with the same slider, swatches and preview as the setup
  wizard. The Address card is read-only: the port is picked when the app starts (PORTS, or ./start.sh with Docker).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { ACCENTS, TEXT_SCALE, type Accent } from '#lib/schemas/settings';
	import { ACCENT_COLOURS } from '#lib/ui/accents';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import Slider from '#lib/ui/Slider.svelte';
	import SwatchGroup from '#lib/ui/SwatchGroup.svelte';
	import TextPreview from '#lib/ui/TextPreview.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The controls start from the saved values and follow them after each save.
	let textScale = $derived(data.settings.textScale);
	let accent = $derived(data.settings.accent);

	const accentOptions = ACCENTS.map((a) => ({
		value: a,
		label: m.accents[a],
		colour: ACCENT_COLOURS[a].base
	}));
	const look = m.wizard.look;

	// A swatch recolours the whole app at once as a preview; Save keeps it. Leaving the page unsaved puts the saved
	// accent back (the root layout keeps <html> in step with the saved settings after a save).
	$effect(() => {
		document.documentElement.dataset.accent = accent;
		return () => (document.documentElement.dataset.accent = data.settings.accent);
	});
	const unsaved = $derived(accent !== data.settings.accent);

	const failed = $derived(form && !('done' in form) ? form : null);
	const fields = $derived((failed?.fields ?? {}) as Record<string, string | undefined>);
</script>

<svelte:head><title>{m.settings.heading} · {m.app.name}</title></svelte:head>

<section class="settings">
	<h2>{m.settings.heading}</h2>
	<p class="dim">{m.settings.intro}</p>

	<form
		method="POST"
		action="?/save"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		{#if form && 'done' in form}
			<Message>{m.settings.saved}</Message>
		{/if}
		{#if failed}<Message kind="danger">{failed.message}</Message>{/if}

		<div class="grid">
			<Card title={m.settings.lookHeading}>
				<Slider
					label={m.settings.textScale}
					name="textScale"
					min={TEXT_SCALE.min}
					max={TEXT_SCALE.max}
					step={TEXT_SCALE.step}
					ticks={[90, 100, 110, 120, 130]}
					format={(v) => `${v} %`}
					hint={m.settings.textScaleHint}
					bind:value={textScale}
					error={fields.textScale}
				/>
				<SwatchGroup
					label={m.settings.accent}
					name="accent"
					options={accentOptions}
					bind:value={() => accent, (v) => (accent = v as Accent)}
					error={fields.accent}
				/>
				<p class="hint">{unsaved ? m.settings.accentPreview : m.settings.accentHint}</p>
				<!-- The text size shows in this preview only: resizing the whole page under the slider would move it. -->
				<TextPreview
					scale={textScale}
					label={look.preview}
					title={look.sampleTitle}
					meta={look.sampleMeta}
					body={look.sampleBody}
					chip={look.sampleChip}
					button={look.sampleButton}
				/>
			</Card>

			<Card title={m.settings.addressHeading}>
				{#if data.settings.portNote}
					<Message kind="warn">{data.settings.portNote}</Message>
				{/if}
				<p>
					<span class="dim">{m.settings.address}</span><br /><code>{data.settings.address}</code>
				</p>
				<div class="port">
					<span class="label">{m.settings.port}</span>
					<span class="data">{data.settings.port}</span>
					<span class="lock"
						><Lock size={13} strokeWidth={1.6} aria-hidden={true} />{m.settings.readOnly}</span
					>
				</div>
				<p class="hint">{data.inDocker ? m.settings.portDocker : m.settings.portPicked}</p>
			</Card>
		</div>

		<div><Button kind="primary" type="submit">{m.common.save}</Button></div>
	</form>
</section>

<style>
	.settings,
	form {
		display: grid;
		gap: var(--space-4);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.port {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.lock {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.1em 0.6em;
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: 1em;
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.hint {
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
</style>
