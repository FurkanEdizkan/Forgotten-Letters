<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/messages';
	import Message from '#lib/ui/Message.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const tabs = [
		{ path: '/owner', label: m.owner.tabs.people },
		{ path: '/owner/invites', label: m.owner.tabs.invites },
		{ path: '/owner/audit', label: m.owner.tabs.audit },
		{ path: '/owner/backups', label: m.owner.tabs.backups }
	];
</script>

<div class="head">
	<h1>{m.owner.title}</h1>
	<nav aria-label={m.owner.title}>
		{#each tabs as t (t.path)}
			<a href={t.path} aria-current={page.url.pathname === t.path ? 'page' : undefined}>{t.label}</a
			>
		{/each}
	</nav>
</div>
{#if data.plainHttp}<Message kind="warn">{m.owner.httpWarning}</Message>{/if}
{@render children()}

<style>
	.head {
		display: grid;
		gap: var(--space-4);
	}
	nav {
		display: flex;
		gap: var(--space-1);
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	nav a {
		padding: var(--space-2) var(--space-4);
		color: var(--bone-dim);
		text-decoration: none;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		border-bottom: 3px solid transparent;
		margin-bottom: -1px;
	}
	nav a:hover {
		color: var(--bone);
	}
	nav a[aria-current='page'] {
		color: var(--bone);
		border-bottom-color: var(--blood-bright);
	}
</style>
