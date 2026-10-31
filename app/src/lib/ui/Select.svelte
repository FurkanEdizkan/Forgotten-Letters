<!-- A labelled select in the square field well, with a Lucide chevron (DESIGN.md §7, Fields). -->
<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type Props = HTMLSelectAttributes & {
		label: string;
		name: string;
		options: { value: string; label: string }[];
		value?: string;
	};
	let { label, name, options, id, value = $bindable(), ...rest }: Props = $props();

	const uid = $props.id();
	const fieldId = $derived(id ?? `${name}-${uid}`);
</script>

<div class="field">
	<label class="label" for={fieldId}>{label}</label>
	<div class="well">
		<select id={fieldId} {name} bind:value {...rest}>
			{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		<ChevronDown size={16} strokeWidth={1.5} aria-hidden={true} />
	</div>
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.well {
		position: relative;
		display: flex;
		align-items: center;
	}
	select {
		width: 100%;
		min-height: var(--button-height);
		padding: var(--space-2) calc(var(--space-2) + 24px) var(--space-2) var(--space-2);
		appearance: none;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
		cursor: pointer;
	}
	select:focus {
		border-color: var(--blood-bright);
	}
	.well :global(svg) {
		position: absolute;
		right: var(--space-2);
		color: var(--bone-dim);
		pointer-events: none;
	}
</style>
