<!--
  The shell's top bar (DESIGN.md §5, App shell): the menu toggle, Docs, the app name and, on the right, the user
  menu. Glass and sticky, so the page scrolls under it. Signed out (help pages) it shows the name, Docs and Sign in.
-->
<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import LogIn from '@lucide/svelte/icons/log-in';
	import Menu from '@lucide/svelte/icons/menu';
	import { page } from '$app/state';
	import { m } from '#lib/messages';
	import type { Role } from '#lib/roles';
	import UserMenu from './UserMenu.svelte';
	import { glow } from './glow';
	import { isUnder } from './nav';
	import './shell-glass.css';

	type Props = {
		me: { username: string; displayName: string; role: Role; mustChangePassword: boolean } | null;
		/** Show the menu toggle (not while a forced password change hides the panel). */
		toggle?: boolean;
		panelOpen?: boolean;
		panelId?: string;
		onToggle?: () => void;
		menuOpen?: boolean;
		toggleButton?: HTMLButtonElement | null;
	};
	let {
		me,
		toggle = false,
		panelOpen = false,
		panelId,
		onToggle,
		menuOpen = $bindable(false),
		toggleButton = $bindable(null)
	}: Props = $props();
</script>

<header class="bar">
	{#if toggle}
		<button
			bind:this={toggleButton}
			class="fl-glass icon"
			type="button"
			use:glow
			aria-expanded={panelOpen}
			aria-controls={panelId}
			aria-label={m.shell.menu}
			title={m.shell.menu}
			onclick={onToggle}
		>
			<Menu size={18} strokeWidth={1.5} aria-hidden={true} />
		</button>
	{/if}
	<a
		class="fl-glass"
		href="/help/docs"
		use:glow
		aria-current={isUnder(page.url.pathname, '/help/docs') ? 'page' : undefined}
	>
		<BookOpen size={16} strokeWidth={1.5} aria-hidden={true} />{m.shell.docs}
	</a>
	<a class="name" href="/">{m.app.name}</a>
	<span class="space"></span>
	{#if me}
		<UserMenu {me} bind:open={menuOpen} />
	{:else}
		<a class="fl-glass" href="/login" use:glow>
			<LogIn size={16} strokeWidth={1.5} aria-hidden={true} />{m.shell.signIn}
		</a>
	{/if}
</header>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--bar-height, 56px);
		padding: 0 var(--gutter);
		background: color-mix(in srgb, var(--night) 74%, transparent);
		backdrop-filter: blur(14px) saturate(1.2);
		/* Light top edge, dark bottom edge: the glass catches the light from above. */
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bone) 8%, transparent);
		border-bottom: var(--border-hairline) solid color-mix(in srgb, var(--inset) 92%, transparent);
	}
	.icon {
		padding: 0 var(--space-2);
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.6rem;
		letter-spacing: var(--track-display);
		text-transform: uppercase;
		color: var(--bone);
		text-decoration: none;
		white-space: nowrap;
		margin-left: var(--space-2);
	}
	.space {
		flex: 1;
	}
	@supports not (backdrop-filter: blur(1px)) {
		.bar {
			background: var(--inset);
			border-bottom-color: var(--rule);
		}
	}
	@media (prefers-reduced-transparency: reduce) {
		.bar {
			background: var(--inset);
			backdrop-filter: none;
			border-bottom-color: var(--rule);
		}
	}
</style>
