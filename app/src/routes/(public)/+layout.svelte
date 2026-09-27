<script lang="ts">
	import { page } from '$app/state';
	import { liveSnapshot } from '$lib/live.svelte';
	import { setLive } from '$lib/context';
	import Lockup from '$lib/components/Lockup.svelte';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally
	const live = data.snapshot ? liveSnapshot(data.snapshot) : null;
	if (live) setLive(live);

	const links = [
		{ href: '/', label: 'Map' },
		{ href: '/campaign', label: 'Campaign' },
		{ href: '/players', label: 'Standings' },
		{ href: '/zones', label: 'Zones' },
		{ href: '/compendium', label: 'Compendium' },
		{ href: '/warbands', label: 'Warband Builder' },
		{ href: '/history', label: 'Chronicle' }
	];
	const isMap = $derived(page.url.pathname === '/');
	// The running footer names the chapter, as at the foot of each page of the book.
	const chapter = $derived(links.find((l) => l.href !== '/' && page.url.pathname.startsWith(l.href))?.label ?? '');
</script>

{#if !live}
	<main class="empty">
		<Lockup name="Carcass Front" />
		<p><em>The campaign has not yet begun.</em> The Campaign Master can found it at <a href="/admin">/admin</a>.</p>
	</main>
{:else}
	{#if !isMap}
		<header>
			<Lockup name={live.current.campaign.name} compact />
			<nav>
				{#each links as l (l.href)}
					<a href={l.href} aria-current={(l.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(l.href)) ? 'page' : undefined}>{l.label}</a>
				{/each}
				{#each data.user?.warbandIds ?? [] as id, i (id)}
					<a href="/warbands/{id}" class="mine" aria-current={page.url.pathname === `/warbands/${id}` ? 'page' : undefined}>{(data.user?.warbandIds.length ?? 0) > 1 ? `My warband ${i + 1}` : 'My warband'}</a>
				{/each}
				{#if data.user}
					<a href={data.user.role === 'cm' ? '/admin' : '/account'} class="who">{data.user.name}</a>
				{:else}
					<a href="/login?next={encodeURIComponent(page.url.pathname)}" class="who">Sign in</a>
				{/if}
			</nav>
		</header>
	{/if}
	{@render children()}
	{#if !isMap && chapter}
		<footer class="running-foot page-foot">{chapter}</footer>
	{/if}
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
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 28px;
		align-items: center;
		justify-content: space-between;
		padding: 10px clamp(16px, 4vw, 40px);
		background: var(--night);
		border-bottom: 2px solid var(--blood);
	}
	nav {
		display: flex;
		gap: 4px 20px;
		flex-wrap: wrap;
	}
	nav a {
		position: relative;
		padding: 4px 0;
		color: var(--bone-dim);
		text-decoration: none;
		font-family: var(--font-title);
		font-size: 1.05rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	nav a:hover {
		color: var(--bone);
	}
	nav a.mine {
		color: var(--ember);
	}
	nav a.who {
		margin-left: 8px;
		padding-left: 14px;
		border-left: 1px solid rgba(236, 229, 211, 0.25);
	}
	nav a[aria-current='page'] {
		color: var(--bone);
	}
	nav a[aria-current='page']::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: var(--blood-bright);
	}
	.page-foot {
		max-width: 72rem;
		margin-inline: auto;
		padding-inline: clamp(16px, 4vw, 40px);
	}
</style>
