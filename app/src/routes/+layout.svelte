<script lang="ts">
	import '#lib/ui/base.css';
	import { m } from '#lib/messages';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{m.app.name}</title>
</svelte:head>

{@render children()}

<footer>
	<span>{m.app.tagline}.</span>
	<span>{m.app.notice}</span>
</footer>

<style>
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		justify-content: center;
		padding: var(--space-5) var(--gutter);
		border-top: var(--border-hairline) solid var(--rule);
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>
