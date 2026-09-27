<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();

	const links = [
		{ href: '/admin', label: 'Campaign' },
		{ href: '/admin/games', label: 'Games' },
		{ href: '/admin/warbands', label: 'Warbands' },
		{ href: '/admin/factions', label: 'Factions' },
		{ href: '/admin/adjustments', label: 'Adjustments' },
		{ href: '/admin/weather', label: 'Weather' },
		{ href: '/admin/lore', label: 'Lore' },
		{ href: '/admin/visions', label: 'Visions' },
		{ href: '/admin/backup', label: 'Backup' }
	];
</script>

{#if page.url.pathname !== '/admin/login'}
	<header>
		<a class="brand" href="/admin">Campaign Master</a>
		{#if data.campaign}
			<nav>
				{#each links as l (l.href)}
					<a href={l.href} aria-current={(l.href === '/admin' ? page.url.pathname === l.href : page.url.pathname.startsWith(l.href)) ? 'page' : undefined}>{l.label}</a>
				{/each}
				<a href="/">Live map ↗</a>
			</nav>
		{/if}
		<form method="POST" action="/admin?/logout"><button class="ghost">Leave</button></form>
	</header>
{/if}

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 20px;
		padding: 10px 16px;
		background: var(--ink);
		color: var(--parchment);
	}
	.brand {
		font-family: var(--font-display);
		font-size: 1.4rem;
		color: var(--parchment);
		text-decoration: none;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		flex: 1;
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
	.ghost {
		background: transparent;
		border-color: var(--rule);
		color: var(--rule);
		padding: 4px 10px;
	}
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 20px 16px 60px;
	}
</style>
