<!--
  A callout: a note set apart by a full hairline border and a faint tint, with an icon. Never a coloured side
  stripe. Kinds: info (accent icon), warn, danger (an error that is announced).
-->
<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Snippet } from 'svelte';

	type Props = { kind?: 'info' | 'warn' | 'danger'; children: Snippet };
	let { kind = 'info', children }: Props = $props();

	const Icon = $derived(kind === 'danger' ? CircleAlert : kind === 'warn' ? TriangleAlert : Info);
</script>

<div class="callout {kind}" role={kind === 'danger' ? 'alert' : undefined}>
	<Icon size={18} strokeWidth={1.6} aria-hidden={true} />
	<div class="body">{@render children()}</div>
</div>

<style>
	.callout {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		padding: 0.65em 0.85em;
		border-radius: 0.5em;
		border: var(--border-hairline) solid var(--rule-strong);
		background: rgb(236 229 211 / 0.035);
		color: var(--bone-dim);
		font-size: var(--size-label);
		line-height: 1.45;
	}
	.callout :global(svg) {
		flex: none;
		margin-top: 0.1em;
		color: var(--blood-bright);
	}
	.warn :global(svg) {
		color: var(--warn);
	}
	.danger {
		border-color: color-mix(in srgb, var(--danger) 60%, var(--rule-strong));
		background: color-mix(in srgb, var(--danger) 8%, transparent);
		color: var(--bone);
	}
	.danger :global(svg) {
		color: var(--danger);
	}
	.body {
		min-width: 0;
	}
</style>
