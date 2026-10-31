<!--
  A labelled multi-line field, square like Field.svelte: inset well, label above (with a character count when
  `maxlength` is set), the error under it in bone with a danger mark.
-->
<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = HTMLTextareaAttributes & {
		label: string;
		name?: string;
		error?: string | null;
		value?: string;
	};
	let {
		label,
		name,
		error,
		id,
		value = $bindable(''),
		maxlength,
		rows = 3,
		...rest
	}: Props = $props();

	const uid = $props.id();
	const fieldId = $derived(id ?? `${name ?? 'text'}-${uid}`);
</script>

<div class="field">
	<label class="label head" for={fieldId}
		><span>{label}</span>{#if maxlength}<span class="count data" aria-hidden="true"
				>{value.length} / {maxlength}</span
			>{/if}</label
	>
	<textarea
		id={fieldId}
		{name}
		{rows}
		{maxlength}
		bind:value
		class:invalid={!!error}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${fieldId}-error` : undefined}
		{...rest}></textarea>
	{#if error}
		<p class="error" id="{fieldId}-error">
			<CircleAlert size={16} strokeWidth={1.5} aria-hidden={true} />{error}
		</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.count {
		font-weight: 400;
		letter-spacing: 0;
	}
	textarea {
		width: 100%;
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
		line-height: var(--line-body);
		resize: vertical;
		transition: border-color var(--duration-fast) var(--easing);
	}
	textarea::placeholder {
		color: var(--bone-faint);
	}
	textarea:focus {
		border-color: var(--blood-bright);
	}
	textarea.invalid {
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
</style>
