<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Lockup from './Lockup.svelte';
	import Mark from './Mark.svelte';
	import { OPERATE, PLAY, isCurrent } from '$lib/nav';

	let { open = $bindable(true), title = 'Carcass Front' }: { open?: boolean; title?: string } = $props();

	const user = $derived(page.data.user as { name: string; role: string; warbandIds: string[] } | null);
	const path = $derived(page.url.pathname);
	// The live map is the one surface the panel covers rather than sits beside.
	const overMap = $derived(path === '/');

	let narrow = $state(false);
	let reduced = $state(false);
	$effect(() => {
		const wide = window.matchMedia('(min-width: 60rem)');
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const read = () => {
			narrow = !wide.matches;
			reduced = motion.matches;
		};
		read();
		wide.addEventListener('change', read);
		motion.addEventListener('change', read);
		return () => {
			wide.removeEventListener('change', read);
			motion.removeEventListener('change', read);
		};
	});

	// A cookie, not localStorage: the server renders the panel at the right width on the first
	// paint, so it never flashes open and snap shut on every navigation.
	function set(v: boolean) {
		open = v;
		document.cookie = `cf_nav=${v ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
	}

	const slide = $derived({ x: -288, duration: reduced ? 0 : 220, easing: cubicOut });
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open && (narrow || overMap)) set(false);
	}}
/>

<button
	class="handle"
	onclick={() => set(!open)}
	aria-expanded={open}
	aria-controls="nav-panel"
	aria-label={open ? 'Close navigation' : 'Open navigation'}
>
	<Mark name={open ? 'close' : 'chevron'} size="0.95em" />
</button>

{#if open}
	{#if narrow || overMap}
		<!-- Over the map and on a phone the panel covers the page, so it needs a way out behind it. -->
		<button class="scrim" onclick={() => set(false)} tabindex="-1" aria-hidden="true"></button>
	{/if}
	<aside id="nav-panel" class="panel" transition:fly={slide}>
		<div class="brand"><Lockup name={title} href="/" compact /></div>

		<nav aria-label="Main">
			{#each PLAY as item (item.href)}
				<a href={item.href} aria-current={isCurrent(item, path) ? 'page' : undefined}>{item.label}</a>
			{/each}

			{#if user?.warbandIds.length}
				<p class="head">My warband{user.warbandIds.length > 1 ? 's' : ''}</p>
				{#each user.warbandIds as id, i (id)}
					<a href="/warbands/{id}" class="mine" aria-current={path === `/warbands/${id}` ? 'page' : undefined}>
						{user.warbandIds.length > 1 ? `Warband ${i + 1}` : 'Roster'}
					</a>
				{/each}
			{/if}
			<a href="/warbands" aria-current={path === '/warbands' ? 'page' : undefined}>
				{user?.warbandIds.length ? 'All warbands' : 'Warband Builder'}
			</a>

			{#if user?.role === 'cm'}
				<p class="head">Campaign Master</p>
				{#each OPERATE as item (item.href)}
					<a href={item.href} aria-current={isCurrent(item, path) ? 'page' : undefined}>{item.label}</a>
				{/each}
			{/if}
		</nav>

		<div class="foot">
			{#if user}
				<a href="/settings" class="who" aria-current={isCurrent({ href: '/settings', label: '' }, path) ? 'page' : undefined}>
					{user.name}
				</a>
				<form method="POST" action="/logout"><button class="ghost">Sign out</button></form>
			{:else}
				<a href="/login?next={encodeURIComponent(path)}" class="who">Sign in</a>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.handle {
		position: fixed;
		top: 10px;
		left: 10px;
		z-index: 6;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		background: var(--night);
		border: 1px solid rgba(236, 229, 211, 0.3);
		color: var(--bone-dim);
		transition: color 0.15s, border-color 0.15s;
	}
	.handle:hover {
		border-color: var(--ember);
		color: var(--bone);
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 4;
		padding: 0;
		border: 0;
		background: rgba(10, 9, 7, 0.55);
	}
	.panel {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: 5;
		display: flex;
		flex-direction: column;
		width: 17rem;
		padding: 52px 0 16px;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--night);
		border-right: 2px solid var(--blood);
	}
	.brand {
		padding: 0 16px 14px;
	}
	nav {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.head {
		margin: 18px 0 2px;
		padding: 0 16px;
		font-family: var(--font-display);
		font-size: 0.95rem;
		color: var(--blood-bright);
	}
	nav a,
	.who {
		position: relative;
		display: block;
		padding: 7px 16px 7px 18px;
		color: var(--bone-dim);
		text-decoration: none;
		font-family: var(--font-title);
		font-size: 1.05rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	nav a:hover,
	.who:hover {
		color: var(--bone);
		background: var(--night-2);
	}
	nav a.mine {
		color: var(--ember);
	}
	nav a[aria-current='page'],
	.who[aria-current='page'] {
		color: var(--bone);
		background: var(--night-2);
	}
	nav a[aria-current='page']::after,
	.who[aria-current='page']::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 3px;
		background: var(--blood-bright);
	}
	.foot {
		margin-top: 18px;
		padding-top: 12px;
		border-top: 1px solid rgba(236, 229, 211, 0.18);
	}
	.foot form {
		padding: 8px 16px 0;
	}
	.ghost {
		width: 100%;
		padding: 4px 12px;
		background: transparent;
		border-color: rgba(236, 229, 211, 0.35);
		color: var(--bone);
	}
	.ghost:hover {
		background: transparent;
		border-color: var(--ember);
		color: var(--bone);
	}
	@media (prefers-reduced-motion: reduce) {
		.handle {
			transition: none;
		}
	}
</style>
