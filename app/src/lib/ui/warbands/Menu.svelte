<!--
  A ⋮ menu (DESIGN.md §6: square, panel-raised, the overlay shadow): the browser's own <details>, so it opens and
  closes with the keyboard and works without script. A click outside or Escape closes it. Its items are forms and
  links given as children.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';

	type Props = { label: string; children: Snippet; align?: 'left' | 'right' };
	let { label, children, align = 'right' }: Props = $props();
	let el: HTMLDetailsElement | undefined = $state();
</script>

<svelte:window
	onclick={(e) => {
		if (el?.open && !el.contains(e.target as Node)) el.open = false;
	}}
	onkeydown={(e) => {
		if (el?.open && e.key === 'Escape') el.open = false;
	}}
/>

<details class="menu" bind:this={el}>
	<summary aria-label={label} title={label}
		><EllipsisVertical size={18} aria-hidden={true} /></summary
	>
	<div class="items" class:left={align === 'left'}>{@render children()}</div>
</details>

<style>
	.menu {
		position: relative;
	}
	summary {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		color: var(--bone-dim);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover,
	.menu[open] summary {
		color: var(--bone);
		background: var(--panel-hover);
	}
	.items {
		position: absolute;
		z-index: 30;
		right: 0;
		top: calc(100% + var(--space-1));
		display: grid;
		min-width: 15rem;
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule-strong);
		box-shadow: var(--shadow-overlay);
	}
	.items.left {
		right: auto;
		left: 0;
	}
	.items :global(> *) {
		border-top: var(--border-hairline) solid var(--rule);
	}
	.items :global(> *:first-child) {
		border-top: 0;
	}
	.items :global(button),
	.items :global(a) {
		display: flex;
		width: 100%;
		gap: var(--space-2);
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: none;
		border: 0;
		color: var(--bone);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.items :global(button:hover:not(:disabled)),
	.items :global(a:hover) {
		background: var(--panel-hover);
	}
	.items :global(button:disabled) {
		color: var(--bone-faint);
		cursor: default;
	}
	.items :global(small) {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>
