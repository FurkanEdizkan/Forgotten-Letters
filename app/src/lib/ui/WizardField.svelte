<!--
  The rounded field of the first-run screens (setup and sign-in): label above, an inset well with 0.45 em corners,
  an accent focus ring, and under it either the hint or, when there is one, the error with its reason. Field.svelte
  stays the square field of the rest of the app.
-->
<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes & {
		label: string;
		name?: string;
		hint?: string;
		error?: string | null;
		/** Monospaced value (ports, addresses). */
		mono?: boolean;
		/** Something at the right end of the well, for example a "Set by Docker" tag or a copy button. */
		suffix?: Snippet;
		input?: HTMLInputElement | null;
	};
	let {
		label,
		name,
		hint,
		error,
		mono = false,
		suffix,
		id,
		value = $bindable(),
		input = $bindable(null),
		readonly,
		disabled,
		...rest
	}: Props = $props();

	const uid = $props.id();
	const fieldId = $derived(id ?? `${name ?? 'field'}-${uid}`);
	const describedBy = $derived(
		[error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : null].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<div class="mfield" class:err={!!error} class:ro={readonly} class:off={disabled}>
	<label class="lab" for={fieldId}>{label}</label>
	<div class="well" class:mono>
		<input
			bind:this={input}
			id={fieldId}
			{name}
			bind:value
			{readonly}
			{disabled}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			{...rest}
		/>
		{#if suffix}<span class="suffix">{@render suffix()}</span>{/if}
	</div>
	{#if error}
		<p class="error" id="{fieldId}-error">
			<CircleAlert size={15} strokeWidth={1.6} aria-hidden={true} />{error}
		</p>
	{:else if hint}
		<p class="hint" id="{fieldId}-hint">{hint}</p>
	{/if}
</div>

<style>
	.mfield {
		display: grid;
		gap: 0.4em;
		min-width: 0;
	}
	.lab {
		font-size: var(--size-label);
		font-weight: 600;
		color: var(--bone);
	}
	.well {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5em;
		padding: 0 0.75em;
		border-radius: 0.45em;
		border: var(--border-hairline) solid var(--rule-strong);
		background: var(--inset);
		box-shadow: 0 1px 0 rgb(0 0 0 / 0.3) inset;
		transition:
			border-color var(--duration-fast) var(--easing),
			box-shadow var(--duration-fast) var(--easing);
	}
	.well:hover {
		border-color: var(--bone-faint);
	}
	/* The ring lives on the well, so a suffix sits inside the focused shape. */
	.well:focus-within {
		border-color: var(--blood-bright);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--blood-bright) 28%, transparent);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 2.4em;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
		font-variant-numeric: lining-nums;
	}
	input:focus,
	input:focus-visible {
		outline: none;
	}
	input::placeholder {
		color: var(--bone-faint);
	}
	.mono input {
		font-family: var(--font-mono);
		font-size: 0.92rem;
	}
	.ro .well {
		background: color-mix(in srgb, var(--panel-raised) 60%, var(--inset));
	}
	.ro input {
		color: var(--bone-dim);
	}
	.off .well {
		background: var(--panel-raised);
		border-color: var(--panel-raised);
	}
	.off input {
		color: var(--bone-faint);
		cursor: not-allowed;
	}
	.err .well,
	.err .well:hover {
		border-color: var(--danger);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
	}
	.suffix {
		display: flex;
		align-items: center;
		margin-left: auto;
		color: var(--bone-dim);
		font-family: var(--font-body);
		font-size: var(--size-label);
	}
	.hint {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.error {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		color: var(--bone);
		font-size: var(--size-label);
	}
	.error :global(svg) {
		flex: none;
		color: var(--danger);
	}
</style>
