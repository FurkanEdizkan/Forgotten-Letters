<!-- Signed in: the app shell. Signed out: a plain top bar with the name, Docs and Sign in. -->
<script lang="ts">
	import Shell from '#lib/ui/shell/Shell.svelte';
	import TopBar from '#lib/ui/shell/TopBar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.me}
	<Shell me={data.me} areas={data.areas}>
		{@render children()}
	</Shell>
{:else}
	<TopBar me={null} />
	<main id="main">
		{@render children()}
	</main>
{/if}

<style>
	main {
		max-width: var(--column);
		margin: 0 auto;
		padding: var(--space-6) var(--gutter) var(--space-7);
		display: grid;
		gap: var(--space-6);
		align-content: start;
		min-height: calc(100vh - 56px - 64px);
	}
</style>
