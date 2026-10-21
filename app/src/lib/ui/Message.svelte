<!-- An inline message: 3px status edge, a matching mark and one plain sentence in bone. -->
<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Snippet } from 'svelte';

	type Props = { kind?: 'ok' | 'warn' | 'danger'; children: Snippet };
	let { kind = 'ok', children }: Props = $props();
	const Icon = $derived(
		kind === 'ok' ? CircleCheck : kind === 'warn' ? TriangleAlert : CircleAlert
	);
</script>

<div class="msg {kind}" role={kind === 'ok' ? 'status' : 'alert'}>
	<Icon size={18} strokeWidth={1.5} aria-hidden={true} />
	<div>{@render children()}</div>
</div>

<style>
	.msg {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		padding: var(--space-3) var(--space-4);
		background: var(--inset);
		border-left: var(--border-status-edge) solid;
		color: var(--bone);
	}
	.msg :global(svg) {
		flex: none;
		margin-top: 3px;
	}
	.ok {
		border-color: var(--ok);
	}
	.ok :global(svg) {
		color: var(--ok);
	}
	.warn {
		border-color: var(--warn);
	}
	.warn :global(svg) {
		color: var(--warn);
	}
	.danger {
		border-color: var(--danger);
	}
	.danger :global(svg) {
		color: var(--danger);
	}
</style>
