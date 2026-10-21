<!--
  A one-time value (invite link, temporary password) in an inset mono box that selects on focus, with a copy
  button where the clipboard is available (it is not on plain-HTTP LAN addresses).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import { m } from '#lib/messages';

	type Props = { label: string; value: string; help?: string };
	let { label, value, help }: Props = $props();

	const uid = $props.id();
	let canCopy = $state(false);
	let copied = $state(false);

	onMount(() => (canCopy = !!navigator.clipboard && window.isSecureContext));

	async function copy() {
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="secret">
	<label class="label" for="secret-{uid}">{label}</label>
	<div class="row">
		<input id="secret-{uid}" readonly {value} onfocus={(e) => e.currentTarget.select()} />
		{#if canCopy}
			<button type="button" class="copy" onclick={copy}>
				{#if copied}<Check size={16} strokeWidth={1.5} aria-hidden={true} />{m.common.copied}
				{:else}<Copy size={16} strokeWidth={1.5} aria-hidden={true} />{m.common.copy}{/if}
			</button>
		{/if}
	</div>
	<p class="help">{help ?? ''}{canCopy ? '' : ` ${m.common.selectHint}`}</p>
</div>

<style>
	.secret {
		display: grid;
		gap: var(--space-1);
	}
	.row {
		display: flex;
	}
	input {
		flex: 1;
		min-width: 0;
		min-height: var(--button-height);
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		color: var(--bone);
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}
	.copy {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: transparent;
		border: var(--border-hairline) solid var(--rule-strong);
		border-left: 0;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		cursor: pointer;
	}
	.copy:hover {
		border-color: var(--blood-bright);
	}
	.help {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>
