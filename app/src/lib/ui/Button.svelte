<!--
  A button (or a link styled as one). Kinds: primary (one per area), ghost, danger. An optional Lucide icon sits
  before the label.
-->
<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		kind?: 'primary' | 'ghost' | 'danger';
		icon?: Component<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
		href?: string;
		download?: boolean;
		children: Snippet;
	};

	let {
		kind = 'ghost',
		icon: Icon,
		href,
		download,
		children,
		type = 'button',
		...rest
	}: Props = $props();
</script>

{#if href}
	<a class="btn {kind}" {href} {download}>
		{#if Icon}<Icon size={16} strokeWidth={1.5} aria-hidden={true} />{/if}
		{@render children()}
	</a>
{:else}
	<button class="btn {kind}" {type} {...rest}>
		{#if Icon}<Icon size={16} strokeWidth={1.5} aria-hidden={true} />{/if}
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
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
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing),
			border-color var(--duration-fast) var(--easing),
			color var(--duration-fast) var(--easing);
	}
	.btn:hover {
		color: var(--bone);
		border-color: var(--blood-bright);
	}
	.primary {
		background: var(--blood);
		border-color: var(--blood);
	}
	.primary:hover {
		background: var(--blood-bright);
		border-color: var(--blood-bright);
	}
	/* Danger inside panels: bone label with the danger mark (DESIGN.md "Known misses"). */
	.danger :global(svg) {
		color: var(--danger);
	}
	.danger:hover {
		border-color: var(--danger);
	}
	.btn:disabled {
		background: var(--panel-raised);
		border-color: var(--panel-raised);
		color: var(--bone-faint);
		cursor: not-allowed;
	}
</style>
