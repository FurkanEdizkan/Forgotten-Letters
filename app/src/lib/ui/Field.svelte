<!--
  A labelled text field: inset well, label above, optional hint below, error under the field in bone with a danger
  mark. Pass `error` from the form's field messages.
-->
<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes & {
		label: string;
		name: string;
		hint?: string;
		error?: string | null;
	};
	let { label, name, hint, error, id, value = $bindable(), ...rest }: Props = $props();

	const uid = $props.id();
	const fieldId = $derived(id ?? `${name}-${uid}`);
</script>

<div class="field">
	<label class="label" for={fieldId}>{label}</label>
	<input
		id={fieldId}
		{name}
		bind:value
		class:invalid={!!error}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={[error && `${fieldId}-error`, hint && `${fieldId}-hint`]
			.filter(Boolean)
			.join(' ') || undefined}
		{...rest}
	/>
	{#if error}
		<p class="error" id="{fieldId}-error">
			<CircleAlert size={16} strokeWidth={1.5} aria-hidden={true} />{error}
		</p>
	{/if}
	{#if hint}<p class="hint" id="{fieldId}-hint">{hint}</p>{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
	}
	input {
		width: 100%;
		min-height: var(--button-height);
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
		transition: border-color var(--duration-fast) var(--easing);
	}
	input::placeholder {
		color: var(--bone-faint);
	}
	input:focus {
		border-color: var(--blood-bright);
	}
	input.invalid {
		border-color: var(--danger);
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
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
</style>
