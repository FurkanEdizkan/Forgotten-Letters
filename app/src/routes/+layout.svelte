<script lang="ts">
	import '#lib/ui/base.css';
	import { page } from '$app/state';
	import { m } from '#lib/messages';
	import { isFullHeightPage } from '#lib/ui/shell/nav';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// The copy-wide look lives on <html>. The server already writes it into the first paint (hooks.server.ts fills
	// the placeholders in app.html), so this only keeps it in step after a change, for example a save on
	// /owner/settings, without a reload.
	$effect(() => {
		const root = document.documentElement;
		root.dataset.accent = data.settings.accent;
		root.style.fontSize = `${data.settings.textScale}%`;
	});

	// Welcome, setup and sign-in fill the window as a split page; the notice sits in their own legal links.
	const bare = $derived(isFullHeightPage(page.url.pathname));
</script>

<svelte:head>
	<title>{m.app.name}</title>
</svelte:head>

{@render children()}

{#if !bare}
	<footer>
		<span>{m.app.tagline}.</span>
		<span>{m.app.notice}</span>
	</footer>
{/if}

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
