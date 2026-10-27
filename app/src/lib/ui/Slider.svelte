<!--
  A range slider: a real <input type="range"> (keyboard, screen readers and forms work as usual) with the filled part
  of the track in the accent, the value in a badge next to the label, and tick labels under it.
-->
<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value' | 'type' | 'min' | 'max' | 'step'> & {
		label: string;
		name: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		/** Values to label under the track. */
		ticks?: number[];
		/** How the badge and the spoken value read, for example (v) => `${v} %`. */
		format?: (v: number) => string;
		hint?: string;
		error?: string | null;
	};
	let {
		label,
		name,
		value = $bindable(),
		min,
		max,
		step = 1,
		ticks = [],
		format = String,
		hint,
		error,
		id,
		disabled,
		...rest
	}: Props = $props();

	const uid = $props.id();
	const fieldId = $derived(id ?? `${name}-${uid}`);
	const fill = $derived(`${((value - min) / (max - min)) * 100}%`);
	const describedBy = $derived(
		[error && `${fieldId}-error`, hint && `${fieldId}-hint`].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="slider" class:disabled class:invalid={!!error}>
	<div class="head">
		<label class="lab" for={fieldId}>{label}</label>
		<output class="val" for={fieldId} aria-hidden="true">{format(value)}</output>
	</div>
	<input
		id={fieldId}
		{name}
		type="range"
		{min}
		{max}
		{step}
		{disabled}
		bind:value
		style:--fill={fill}
		aria-valuetext={format(value)}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		{...rest}
	/>
	{#if ticks.length}
		<div class="ticks" aria-hidden="true">
			{#each ticks as t (t)}
				<span style:left="{((t - min) / (max - min)) * 100}%">{t}</span>
			{/each}
		</div>
	{/if}
	{#if error}
		<p class="error" id="{fieldId}-error">
			<CircleAlert size={16} strokeWidth={1.5} aria-hidden={true} />{error}
		</p>
	{:else if hint}
		<p class="hint" id="{fieldId}-hint">{hint}</p>
	{/if}
</div>

<style>
	.slider {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.lab {
		font-size: var(--size-label);
		font-weight: 600;
		color: var(--bone);
	}
	.val {
		padding: 0.1em 0.5em;
		border-radius: 0.35em;
		background: var(--panel-raised);
		color: var(--bone);
		font-family: var(--font-mono);
		font-size: var(--size-label);
		font-weight: 600;
		font-variant-numeric: lining-nums tabular-nums;
	}
	input {
		--thumb: 1.15em;
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 1.4em;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}
	input::-webkit-slider-runnable-track {
		height: 0.4em;
		border-radius: 1em;
		background: linear-gradient(
			90deg,
			var(--blood-bright) var(--fill),
			var(--panel-raised) var(--fill)
		);
	}
	input::-moz-range-track {
		height: 0.4em;
		border-radius: 1em;
		background: var(--panel-raised);
	}
	input::-moz-range-progress {
		height: 0.4em;
		border-radius: 1em;
		background: var(--blood-bright);
	}
	input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: var(--thumb);
		height: var(--thumb);
		margin-top: calc((0.4em - var(--thumb)) / 2);
		border-radius: var(--radius-disc);
		background: var(--bone);
		border: 2px solid var(--blood-bright);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
		transition:
			box-shadow var(--duration-fast) var(--easing),
			scale var(--duration-fast) var(--easing);
	}
	input::-moz-range-thumb {
		width: var(--thumb);
		height: var(--thumb);
		border-radius: var(--radius-disc);
		background: var(--bone);
		border: 2px solid var(--blood-bright);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
	}
	input:hover::-webkit-slider-thumb {
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--blood-bright) 20%, transparent);
	}
	input:active::-webkit-slider-thumb {
		scale: 1.1;
	}
	/* The ring replaces the outline on the thumb, where the eye already is. */
	input:focus-visible {
		outline: none;
	}
	input:focus-visible::-webkit-slider-thumb {
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--blood-bright) 45%, transparent);
	}
	input:focus-visible::-moz-range-thumb {
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--blood-bright) 45%, transparent);
	}
	.disabled input {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.invalid input::-webkit-slider-thumb {
		border-color: var(--danger);
	}
	.invalid input::-moz-range-thumb {
		border-color: var(--danger);
	}
	/* Ticks sit under their values; the thumb's half-width keeps the end labels over the ends of its travel. */
	.ticks {
		position: relative;
		height: 1.2em;
		margin: 0 calc(var(--thumb, 1.15em) / 2);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-variant-numeric: lining-nums tabular-nums;
		color: var(--bone-dim);
	}
	.ticks span {
		position: absolute;
		translate: -50% 0;
	}
	.error {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		color: var(--bone);
		font-size: var(--size-label);
	}
	.error :global(svg) {
		color: var(--danger);
		flex: none;
	}
	.hint {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>
