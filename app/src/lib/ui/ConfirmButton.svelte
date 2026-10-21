<!--
  A destructive submit button confirmed in place: the first press turns it into the confirm label for 4 seconds; a
  second press submits. No modal.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { m } from '#lib/messages';

	type Props = {
		label: string;
		confirm: string;
		name?: string;
		value?: string;
		formaction?: string;
	};
	let { label, confirm, name, value, formaction }: Props = $props();

	const uid = $props.id();
	let armed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function onclick(e: MouseEvent) {
		if (armed) {
			// Let this press submit, then return to the plain label.
			clearTimeout(timer);
			timer = setTimeout(() => (armed = false));
			return;
		}
		e.preventDefault();
		armed = true;
		clearTimeout(timer);
		timer = setTimeout(() => (armed = false), 4000);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<button
	class="btn"
	class:armed
	type="submit"
	{name}
	{value}
	{formaction}
	{onclick}
	aria-describedby={armed ? `confirm-${uid}` : undefined}
>
	<TriangleAlert size={16} strokeWidth={1.5} aria-hidden={true} />
	{armed ? confirm : label}
</button>
{#if armed}<span id="confirm-{uid}" class="visually-hidden" aria-live="polite"
		>{m.common.confirmHint}</span
	>{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--button-height);
		padding: var(--space-2) 18px;
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		background: transparent;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--easing),
			background-color var(--duration-fast) var(--easing);
	}
	.btn :global(svg) {
		color: var(--danger);
	}
	.btn:hover {
		border-color: var(--danger);
	}
	.armed {
		border-color: var(--danger);
		background: var(--inset);
	}
</style>
