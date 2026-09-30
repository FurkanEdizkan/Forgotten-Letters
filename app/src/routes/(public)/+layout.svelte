<script lang="ts">
	import { page } from '$app/state';
	import { liveSnapshot } from '$lib/live.svelte';
	import { setLive } from '$lib/context';
	import Lockup from '$lib/components/Lockup.svelte';
	import NavPanel from '$lib/components/NavPanel.svelte';
	import { chapterOf } from '$lib/nav';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally
	const live = data.snapshot ? liveSnapshot(data.snapshot) : null;
	if (live) setLive(live);

	// The live map is full-bleed: the panel covers it rather than sitting beside it.
	const isMap = $derived(page.url.pathname === '/');
	// Settings must open on a fresh install too, before any campaign has been founded.
	const settings = $derived(page.url.pathname.startsWith('/settings'));
	const first = $derived(!!page.data.first);
	// While the Campaign Master sets the campaign up, everyone else sees a waiting page (Muster and Settings stay open).
	const preparing = $derived(
		live?.current.campaign.stage === 'setup' && !data.isAdmin && !settings && !page.url.pathname.startsWith('/muster')
	);
	// The running footer names the chapter, as at the foot of each page of the book.
	const chapter = $derived(chapterOf(page.url.pathname));

	// svelte-ignore state_referenced_locally
	let navOpen = $state(data.navOpen);
</script>

{#if first}
	<!-- A temporary password pins the user here: a panel of links that all bounce back would only mislead. -->
	{@render children()}
{:else if (!live && !settings) || preparing}
	<main class="empty">
		<Lockup name={live?.current.campaign.name ?? 'Carcass Front'} />
		{#if live}
			<p><em>The campaign is being prepared.</em> The Campaign Master is setting out the seats; invite links follow.</p>
			{#if !data.user}<p><a href="/login">Sign in</a></p>{/if}
		{:else}
			<p><em>The campaign has not yet begun.</em> The Campaign Master can found it at <a href="/admin">/admin</a>.</p>
		{/if}
	</main>
{:else}
	<a class="skip" href="#main">Skip to content</a>
	{#if data.user}
		<NavPanel bind:open={navOpen} title={live?.current.campaign.name ?? 'Carcass Front'} />
	{/if}
	<div class="shell" class:beside={navOpen && !isMap && !!data.user} class:guest={!data.user}>
		{#if !data.user && !isMap}
			<!-- Visitors have no panel: a way back from the pages the map links to. -->
			<a class="to-map" href="/">← The live map</a>
		{/if}
		<main id="main" tabindex="-1">
			{@render children()}
		</main>
		{#if !isMap && chapter}
			<footer class="running-foot page-foot">{chapter}</footer>
		{/if}
	</div>
{/if}

<style>
	.empty {
		display: grid;
		gap: 18px;
		justify-items: start;
		max-width: 40rem;
		margin: 0 auto;
		padding: 18vh 24px;
		min-height: 100vh;
		background: var(--night);
		color: var(--bone);
	}
	.empty :global(.name) {
		font-size: 3rem;
	}
	.empty a {
		color: var(--ember);
	}
	.skip {
		position: absolute;
		left: -9999px;
		z-index: 7;
		padding: 8px 14px;
		background: var(--night);
		color: var(--bone);
	}
	.skip:focus {
		left: 8px;
		top: 8px;
	}
	main:focus {
		outline: none;
	}
	/* The reading pages make room for the panel; the map is covered by it instead. The panel
	   slides on transform, but this padding snaps: animating it would thrash layout, and on the
	   map it would re-fire the canvas ResizeObserver on every frame of the slide. */
	/* With the panel shut the handle floats over the page: keep its corner clear. */
	.shell:not(.beside) {
		padding-top: 46px;
	}
	.shell.beside {
		padding-left: 17rem;
	}
	/* No handle to keep clear for visitors. */
	.shell.guest {
		padding-top: 0;
	}
	.to-map {
		display: block;
		max-width: 72rem;
		margin-inline: auto;
		padding: 14px clamp(16px, 4vw, 40px) 0;
		color: var(--ink-soft);
		font-family: var(--font-title);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
	}
	.to-map:hover {
		color: var(--blood);
	}
	@media (max-width: 60rem) {
		.shell.beside {
			padding-left: 0;
		}
	}
	.page-foot {
		max-width: 72rem;
		margin-inline: auto;
		padding-inline: clamp(16px, 4vw, 40px);
	}
</style>
