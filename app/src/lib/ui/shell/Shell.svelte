<!--
  The app shell for signed-in pages: the top bar over the left panel and the page. Owns the panel's state:
  - before the browser runs, the panel follows the window width in CSS (open from 1920 px), so the first paint is
    right without a script;
  - afterwards the person's own choice wins, remembered in localStorage (wrapped in try/catch: storage may be off);
  - Esc closes the user menu first (Bits UI does that), then the panel.
  While a navigation to another page takes longer than a moment, skeleton blocks stand in for the page.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { navigating, page } from '$app/state';
	import { m } from '#lib/messages';
	import type { Role } from '#lib/roles';
	import TopBar from './TopBar.svelte';
	import SidePanel from './SidePanel.svelte';
	import PageSkeleton from './PageSkeleton.svelte';
	import { PANEL_OPEN_FROM, readPanelChoice, savePanelChoice } from './nav';

	type Props = {
		me: { username: string; displayName: string; role: Role; mustChangePassword: boolean };
		areas: { path: string; label: string }[];
		children: Snippet;
	};
	let { me, areas, children }: Props = $props();

	const PANEL_ID = 'fl-panel';
	const storage = () => globalThis.localStorage;

	// null until mounted: the server cannot know the width or the stored choice.
	let wide = $state<boolean | null>(null);
	let choice = $state<boolean | null>(null);
	let animate = $state(false);
	let menuOpen = $state(false);
	let toggleButton = $state<HTMLButtonElement | null>(null);

	// A forced password change keeps the person on one page: no panel, no areas.
	const withPanel = $derived(!me.mustChangePassword);
	const open = $derived(choice ?? wide ?? false);
	const panelState = $derived(wide === null ? 'auto' : open ? 'open' : 'closed');

	onMount(() => {
		const mq = matchMedia(`(min-width: ${PANEL_OPEN_FROM}px)`);
		const onWidth = () => (wide = mq.matches);
		onWidth();
		choice = readPanelChoice(storage);
		mq.addEventListener('change', onWidth);
		// Slide only from the next frame on, so restoring a choice does not animate on load.
		const frame = requestAnimationFrame(() => (animate = true));
		return () => {
			mq.removeEventListener('change', onWidth);
			cancelAnimationFrame(frame);
		};
	});

	function setPanel(next: boolean) {
		choice = next;
		savePanelChoice(storage, next);
	}

	// Capture phase: this runs before Bits UI closes the menu, so one Esc closes only the menu.
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented || menuOpen || !open || !withPanel) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const inPanel = !!t?.closest(`#${PANEL_ID}`);
		setPanel(false);
		// Focus would be lost in a hidden panel; hand it to the toggle that reopens it.
		if (inPanel) toggleButton?.focus();
	}

	// Skeletons only for a slow change of page; a quick one swaps straight to the new page.
	let slow = $state(false);
	$effect(() => {
		const to = navigating.to;
		if (!to || to.url.pathname === page.url.pathname) {
			slow = false;
			return;
		}
		const timer = setTimeout(() => (slow = true), 150);
		return () => clearTimeout(timer);
	});
</script>

<svelte:window onkeydowncapture={onKeydown} />

<div class="shell">
	<a class="skip" href="#main">{m.shell.skip}</a>
	<TopBar
		{me}
		toggle={withPanel}
		panelOpen={open}
		panelId={PANEL_ID}
		onToggle={() => setPanel(!open)}
		bind:menuOpen
		bind:toggleButton
	/>
	<div class="body">
		{#if withPanel}
			<SidePanel id={PANEL_ID} state={panelState} {animate} {areas} />
		{/if}
		<main id="main" tabindex="-1">
			{#if slow}<PageSkeleton />{:else}{@render children()}{/if}
		</main>
	</div>
</div>

<style>
	.shell {
		--bar-height: 56px;
	}
	.body {
		display: flex;
		align-items: flex-start;
	}
	main {
		flex: 1;
		min-width: 0;
		max-width: var(--column);
		margin: 0 auto;
		padding: var(--space-6) var(--gutter) var(--space-7);
		display: grid;
		gap: var(--space-6);
		align-content: start;
		min-height: calc(100vh - var(--bar-height) - 64px);
	}
	main:focus {
		outline: none;
	}
	.skip {
		position: absolute;
		left: var(--space-2);
		top: -100px;
		z-index: 40;
		padding: var(--space-2) var(--space-3);
		background: var(--panel);
		color: var(--bone);
	}
	.skip:focus {
		top: var(--space-2);
	}
</style>
