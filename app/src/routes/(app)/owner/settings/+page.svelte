<!--
  The Owner's copy-wide settings: text size, accent and port. Plain native controls for now; the setup wizard's
  slider, swatches and field (task T3) replace them once both are merged.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import { ACCENTS, TEXT_SCALE } from '#lib/schemas/settings';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The controls start from the saved values and follow them after each save.
	let textScale = $derived(data.settings.textScale);
	let accent = $derived(data.settings.accent);

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
				<div class="control">
					<label class="label" for="textScale">{m.settings.textScale}</label>
					<div class="range">
						<input
							id="textScale"
							name="textScale"
							type="range"
							min={TEXT_SCALE.min}
							max={TEXT_SCALE.max}
							step={TEXT_SCALE.step}
							bind:value={textScale}
							aria-describedby="textScale-hint"
						/>
						<output for="textScale" class="data">{textScale} %</output>
					</div>
					<p class="hint" id="textScale-hint">{m.settings.textScaleHint}</p>
					{#if fields.textScale}<p class="error">{fields.textScale}</p>{/if}
				</div>

				<fieldset class="control" aria-describedby="accent-hint">
					<legend class="label">{m.settings.accent}</legend>
					<div class="accents">
						{#each ACCENTS as a (a)}
							<label class="accent">
								<input type="radio" name="accent" value={a} bind:group={accent} />
								{m.settings.accents[a]}
							</label>
						{/each}
					</div>
					<p class="hint" id="accent-hint">{m.settings.accentHint}</p>
					{#if fields.accent}<p class="error">{fields.accent}</p>{/if}
				</fieldset>
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
					<Field
						label={m.settings.port}
						name="port"
						type="number"
						inputmode="numeric"
						required
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
	legend {
		padding: 0;
		margin-bottom: var(--space-2);
	}
	.range {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.range input {
		flex: 1;
		accent-color: var(--blood-bright);
	}
	output {
		min-width: 4.5ch;
		text-align: right;
	}
	.accents {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	.accent {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--button-height);
		cursor: pointer;
	}
	.accent input {
		accent-color: var(--blood-bright);
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
