<script lang="ts">
	import { page } from '$app/state';
	import Lockup from '$lib/components/Lockup.svelte';
	import Mark from '$lib/components/Mark.svelte';

	let { data, children } = $props();

	const links = [
		{ href: '/admin', label: 'Campaign' },
		{ href: '/admin/games', label: 'Games' },
		{ href: '/admin/players', label: 'Players' },
		{ href: '/admin/warbands', label: 'Warbands' },
		{ href: '/admin/factions', label: 'Factions' },
		{ href: '/admin/adjustments', label: 'Adjustments' },
		{ href: '/admin/weather', label: 'Weather' },
		{ href: '/admin/lore', label: 'Lore' },
		{ href: '/admin/rules', label: 'Rules' },
		{ href: '/admin/visions', label: 'Visions' },
		{ href: '/admin/backup', label: 'Backup' }
	];
</script>

{#if data.campaign !== undefined}
	<header>
		<Lockup name="Campaign Master" href="/admin" compact />
		{#if data.campaign}
			<nav>
				{#each links as l (l.href)}
					<a href={l.href} aria-current={(l.href === '/admin' ? page.url.pathname === l.href : page.url.pathname.startsWith(l.href)) ? 'page' : undefined}>{l.label}</a>
				{/each}
				<a href="/" class="out">Live map <Mark name="external" size="0.8em" /></a>
			</nav>
		{/if}
		<form method="POST" action="/logout"><button class="ghost">Sign out</button></form>
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
		gap: 8px 28px;
		padding: 10px clamp(16px, 4vw, 40px);
		background: var(--night);
		border-bottom: 2px solid var(--blood);
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 18px;
		flex: 1;
	}
	nav a {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 0;
		color: var(--bone-dim);
		text-decoration: none;
		font-family: var(--font-title);
		font-size: 1rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	nav a:hover {
		color: var(--bone);
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
	nav .out {
		color: var(--ember);
	}
	.ghost {
		background: transparent;
		border-color: rgba(236, 229, 211, 0.35);
		color: var(--bone);
		padding: 4px 12px;
	}
	.ghost:hover {
		background: transparent;
		border-color: var(--ember);
		color: #fff;
	}
	@media (max-width: 40rem) {
		header {
			justify-content: space-between;
		}
		nav {
			order: 3;
			flex-basis: 100%;
			gap: 2px 14px;
		}
		nav a {
			font-size: 0.9rem;
		}
	}
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 64px;
	}
</style>
