<!--
  The Owner's copy-wide settings: text size, accent and port, with the same slider, swatches, preview and field as
  the setup wizard.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import { ACCENTS, TEXT_SCALE, type Accent } from '#lib/schemas/settings';
	import { ACCENT_COLOURS } from '#lib/ui/accents';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import SwatchGroup from '#lib/ui/SwatchGroup.svelte';
	import TextPreview from '#lib/ui/TextPreview.svelte';
	import WizardField from '#lib/ui/WizardField.svelte';
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

	const failed = $derived(form && !('done' in form) ? form : null);
	const fields = $derived((failed?.fields ?? {}) as Record<string, string | undefined>);
	const moveTo = $derived(form && 'done' in form ? form.moveTo : null);

	// Kit cannot navigate to another origin, so after a port change the browser is sent to the new address once the
	// message has been seen. The old port closes a little later, so this page keeps working until then.
	$effect(() => {
		if (!moveTo) return;
		const target = new URL(location.pathname, moveTo).href;
		const timer = setTimeout(() => location.assign(target), 2500);
		return () => clearTimeout(timer);
	});
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
		{#if moveTo}
			<Message>{m.settings.moving(moveTo)}</Message>
		{:else if form && 'done' in form}
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
				<p class="hint">{m.settings.accentHint}</p>
				<!-- The preview follows the slider; the accent shows on the whole page once saved. -->
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
				<p>
					<span class="dim">{m.settings.address}</span><br /><code>{data.settings.address}</code>
				</p>
				{#if data.settings.portLocked}
					<div class="control">
						<span class="label">{m.settings.port}</span>
						<p class="data">{data.settings.port}</p>
						<p class="dim">{m.settings.portLocked}</p>
						<pre><code>APP_PORT={data.settings.port}</code></pre>
						<p class="dim">{m.settings.portLockedThen}</p>
						<pre><code>docker compose up -d</code></pre>
						{#if fields.port}<p class="error">{fields.port}</p>{/if}
					</div>
				{:else}
					<!-- No min/max: the server's message says why a port is refused; the browser's would not. -->
					<WizardField
						label={m.settings.port}
						name="port"
						type="number"
						inputmode="numeric"
						required
						mono
						value={String(data.settings.port)}
						hint={m.settings.portHint}
						error={fields.port}
					/>
				{/if}
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
	.control {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.hint {
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
	.error {
		color: var(--bone);
		font-size: var(--size-label);
		border-left: var(--border-status-edge) solid var(--danger);
		padding-left: var(--space-2);
	}
	pre {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule);
		overflow-x: auto;
	}
</style>
