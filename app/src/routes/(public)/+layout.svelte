<script lang="ts">
	import { page } from '$app/state';
	import { liveSnapshot } from '$lib/live.svelte';
	import { setLive } from '$lib/context';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally
	const live = data.snapshot ? liveSnapshot(data.snapshot) : null;
	if (live) setLive(live);

	const links = [
		{ href: '/', label: 'Map' },
		{ href: '/players', label: 'Standings' },
		{ href: '/zones', label: 'Zones' },
		{ href: '/history', label: 'Chronicle' }
	];
	const isMap = $derived(page.url.pathname === '/');
</script>

{#if !live}
	<main class="empty">
		<div class="kicker">Trench Crusade · Campaign</div>
		<h1>Carcass Front</h1>
		<p><em>The campaign has not yet begun.</em> The Campaign Master can found it at <a href="/admin">/admin</a>.</p>
	</main>
{:else}
	{#if !isMap}
		<header>
			<a class="brand" href="/">{live.current.campaign.name}</a>
			<nav>
				{#each links as l (l.href)}
					<a href={l.href} aria-current={(l.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(l.href)) ? 'page' : undefined}>{l.label}</a>
				{/each}
			</nav>
		</header>
	{/if}
	{@render children()}
{/if}

<style>
	.empty {
		max-width: 40rem;
		margin: 15vh auto;
		padding: 0 16px;
	}
	.kicker {
		font-variant-caps: small-caps;
		font-weight: 600;
		letter-spacing: 0.14em;
		color: var(--blood);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		align-items: center;
		padding: 10px 16px;
		background: var(--ink);
	}
	.brand {
		font-family: var(--font-display);
		font-size: 1.4rem;
		color: var(--parchment);
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 16px;
	}
	nav a {
		color: var(--rule);
		text-decoration: none;
		font-variant-caps: small-caps;
		letter-spacing: 0.06em;
	}
	nav a[aria-current='page'],
	nav a:hover {
		color: var(--parchment);
	}
</style>
