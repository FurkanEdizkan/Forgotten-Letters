<script lang="ts">
	import { page } from '$app/state';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { m } from '#lib/messages';
	import RoleBadge from '#lib/ui/RoleBadge.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const here = (path: string) =>
		page.url.pathname === path || page.url.pathname.startsWith(path + '/');
</script>

<header>
	<a class="name" href="/">{m.app.name}</a>
	{#if !data.me.mustChangePassword}
		<nav aria-label={m.header.areas}>
			{#each data.areas as area (area.path)}
				<a href={area.path} aria-current={here(area.path) ? 'page' : undefined}>{area.label}</a>
			{/each}
		</nav>
	{/if}
	<div class="me">
		<span class="who"
			><span class="visually-hidden">{m.header.signedInAs}</span>{data.me.displayName}</span
		>
		<RoleBadge role={data.me.role} />
		{#if !data.me.mustChangePassword}
			<a href="/account" aria-current={here('/account') ? 'page' : undefined}>{m.header.account}</a>
		{/if}
		<form method="POST" action="/logout">
			<button type="submit"
				><LogOut size={16} strokeWidth={1.5} aria-hidden={true} />{m.header.signOut}</button
			>
		</form>
	</div>
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		align-items: stretch;
		gap: var(--space-6);
		padding: 0 var(--gutter);
		background: var(--panel);
		border-bottom: var(--border-hairline) solid var(--rule);
		min-height: 56px;
	}
	.name {
		align-self: center;
		font-family: var(--font-display);
		font-size: 1.6rem;
		letter-spacing: var(--track-display);
		text-transform: uppercase;
		color: var(--bone);
		text-decoration: none;
		white-space: nowrap;
	}
	nav {
		display: flex;
		gap: var(--space-1);
	}
	nav a,
	.me a,
	.me button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		color: var(--bone-dim);
		text-decoration: none;
		font-family: var(--font-body);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		border-bottom: 3px solid transparent;
		transition:
			color var(--duration-fast) var(--easing),
			border-color var(--duration-fast) var(--easing);
	}
	nav a:hover,
	.me a:hover,
	.me button:hover {
		color: var(--bone);
	}
	[aria-current='page'] {
		color: var(--bone);
		border-bottom-color: var(--blood-bright);
	}
	.me {
		margin-left: auto;
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
	}
	.who,
	.me :global(.badge) {
		align-self: center;
	}
	.who {
		color: var(--bone);
		margin-right: var(--space-1);
	}
	form {
		display: flex;
	}
	.me button {
		background: none;
		border-top: 0;
		border-left: 0;
		border-right: 0;
		cursor: pointer;
	}
	main {
		max-width: var(--column);
		margin: 0 auto;
		padding: var(--space-6) var(--gutter) var(--space-7);
		display: grid;
		gap: var(--space-6);
		min-height: calc(100vh - 56px - 64px);
		align-content: start;
	}
</style>
