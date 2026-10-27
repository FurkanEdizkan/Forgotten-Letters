<!--
  The shell's left panel (DESIGN.md §5): the areas the person can use, the current one marked, the owner area as a
  group of its sections, and the help and legal links at its foot. It pushes the page instead of covering it and slides
  in 220 ms (off under reduced motion). `state` is 'auto' until the browser has run: then CSS opens it on a
  full-HD window, so the first paint already matches the width.
  Closed, it is `visibility: hidden`, which also takes its links out of the tab order.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/messages';
	import { HELP_LINKS, isUnder, OWNER_SECTIONS } from './nav';

	type Props = {
		id: string;
		state: 'auto' | 'open' | 'closed';
		/** Turn the slide on only after the first paint, so a remembered choice does not animate on load. */
		animate: boolean;
		areas: { path: string; label: string }[];
	};
	let { id, state, animate, areas }: Props = $props();

	const path = $derived(page.url.pathname);
	const current = (link: string) => (isUnder(path, link) ? 'page' : undefined);
	// Inside the owner area, People is "/owner" itself, so it is current only on that exact page.
	const currentSection = (link: string) =>
		(link === '/owner' ? path === link : isUnder(path, link)) ? 'page' : undefined;
</script>

<div {id} class="side" class:animate data-state={state}>
	<nav class="areas" aria-label={m.shell.areas}>
		{#each areas as area (area.path)}
			{#if area.path === '/owner'}
				<!-- The owner area is a group of sections; its first section (People) is the area's own page. -->
				<span class="area group" id="{id}-owner">{area.label}</span>
				<ul aria-labelledby="{id}-owner">
					{#each OWNER_SECTIONS as s (s.path)}
						<li><a href={s.path} aria-current={currentSection(s.path)}>{s.label}</a></li>
					{/each}
				</ul>
			{:else}
				<a class="area" href={area.path} aria-current={current(area.path)}>{area.label}</a>
			{/if}
		{/each}
	</nav>
	<nav class="legal" aria-label={m.shell.helpLinks}>
		{#each HELP_LINKS as l (l.path)}
			<a href={l.path} aria-current={current(l.path)}>{l.label}</a>
		{/each}
	</nav>
</div>

<style>
	.side {
		--panel-width: 16rem;
		flex: none;
		position: sticky;
		top: var(--bar-height, 56px);
		width: var(--panel-width);
		height: calc(100vh - var(--bar-height, 56px));
		display: grid;
		grid-template-rows: 1fr auto;
		overflow-y: auto;
		background: var(--panel);
		border-right: var(--border-hairline) solid var(--rule);
		/* Closed: slid out to the left; the negative margin lets the page take the space. */
		margin-left: calc(-1 * var(--panel-width));
		visibility: hidden;
	}
	.side[data-state='open'] {
		margin-left: 0;
		visibility: visible;
	}
	@media (min-width: 1920px) {
		.side[data-state='auto'] {
			margin-left: 0;
			visibility: visible;
		}
	}
	/* Hidden only after the slide out ends; shown at once when it slides in. */
	.side.animate {
		transition:
			margin-left 220ms ease-out,
			visibility 0s linear 220ms;
	}
	.side.animate[data-state='open'] {
		transition:
			margin-left 220ms ease-out,
			visibility 0s linear 0s;
	}
	@media (prefers-reduced-motion: reduce) {
		.side.animate,
		.side.animate[data-state='open'] {
			transition: none;
		}
	}

	.areas {
		display: grid;
		align-content: start;
		gap: var(--space-1);
		padding: var(--space-4) var(--space-2);
	}
	.areas a {
		display: block;
		padding: var(--space-2) var(--space-3);
		color: var(--bone-dim);
		text-decoration: none;
		transition:
			color var(--duration-fast) var(--easing),
			background-color var(--duration-fast) var(--easing);
	}
	.areas a:hover {
		color: var(--bone);
		background: var(--panel-hover);
	}
	.areas a[aria-current='page'] {
		color: var(--bone);
		background: var(--panel-raised);
		box-shadow: inset var(--border-card-top) 0 0 var(--blood-bright);
	}
	.area {
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	ul {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0 0 0 var(--space-3);
		display: grid;
		gap: 2px;
	}
	.group {
		display: block;
		padding: var(--space-2) var(--space-3) var(--space-1);
		color: var(--bone-dim);
	}
	.legal {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-top: var(--border-hairline) solid var(--rule);
		font-size: var(--size-label);
	}
	.legal a {
		color: var(--bone-dim);
		text-decoration: none;
	}
	.legal a:hover,
	.legal a[aria-current='page'] {
		color: var(--bone);
		text-decoration: underline;
	}
</style>
