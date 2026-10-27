<!--
  /welcome: the first page of a fresh install. Every page sends here while no Owner exists (hooks). The emblem in the
  dark well, the name and one Setup button; the docs as a glass icon, the support links and the legal footer.
  Setup hands off into /setup: the split moves to the wizard's proportions, then the page navigates. Without
  scripts, or under reduced motion, Setup is a plain link.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Coffee from '@lucide/svelte/icons/coffee';
	import Bitcoin from '@lucide/svelte/icons/bitcoin';
	import { m } from '#lib/messages';
	import SplitStage, { SPLIT } from '#lib/ui/SplitStage.svelte';
	import GlassButton from '#lib/ui/GlassButton.svelte';
	import { emblemIn, entrance, handOff, reducedMotion } from '#lib/ui/motion';

	let root: HTMLElement | null = $state(null);
	let emblem: HTMLElement | null = $state(null);
	let home: HTMLElement | null = $state(null);
	let extras: HTMLElement[] = $state([]);
	let leaving = $state(false);

	const legal = [
		{ href: '/help/terms', label: m.welcome.terms },
		{ href: '/help/privacy', label: m.welcome.privacy },
		{ href: '/help/licence', label: m.welcome.licence },
		{ href: '/help/contact', label: m.welcome.contact },
		{ href: '/help/faq', label: m.welcome.faq }
	];

	onMount(() => {
		// Reveals only: everything is already visible from the server render.
		emblemIn(emblem);
		if (home) entrance(Array.from(home.children), { delay: 250 });
		entrance(extras.filter(Boolean), { delay: 500, gap: 60 });
	});

	async function start(e: MouseEvent) {
		// Let the browser handle new-tab clicks; skip the movement when it is not wanted.
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		if (reducedMotion() || !root) return;
		e.preventDefault();
		if (leaving) return;
		leaving = true;
		await handOff(root, home ? [home] : [], { from: SPLIT.welcome, to: SPLIT.setup });
		await goto('/setup');
	}
</script>

<svelte:head><title>{m.welcome.title} · {m.app.name}</title></svelte:head>

<SplitStage split={SPLIT.welcome} bind:root bind:emblem>
	<main class="field" class:leaving>
		<div class="docs" bind:this={extras[0]}>
			<GlassButton variant="icon" href="/help/docs" label={m.welcome.docs}>
				<BookOpen strokeWidth={1.6} aria-hidden={true} />
			</GlassButton>
		</div>

		<div class="home" bind:this={home}>
			<h1 class="brand">{m.app.name}</h1>
			<p class="sub">{m.app.tagline}</p>
			<GlassButton variant="primary" href="/setup" class="go" onclick={start}>
				<span>{m.welcome.setup}</span>
				<small>{m.welcome.setupHint}</small>
			</GlassButton>
		</div>

		<div class="foot">
			<section class="support" aria-labelledby="support-h" bind:this={extras[1]}>
				<h2 class="sup-h" id="support-h">{m.welcome.support}</h2>
				<div class="sup-row">
					<GlassButton variant="round-icon" href="/help/support" label={m.welcome.patreon}>
						<!-- A plain mark in the spirit of Patreon's (a disc and a bar), drawn here rather than their logo. -->
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="14.5" cy="9.5" r="5.5" fill="currentColor" />
							<rect x="4" y="4" width="3" height="16" fill="currentColor" />
						</svg>
					</GlassButton>
					<GlassButton variant="round-icon" href="/help/support" label={m.welcome.coffee}>
						<Coffee strokeWidth={1.6} aria-hidden={true} />
					</GlassButton>
					<GlassButton variant="round-icon" href="/help/support" label={m.welcome.bitcoin}>
						<Bitcoin strokeWidth={1.6} aria-hidden={true} />
					</GlassButton>
				</div>
			</section>

			<footer class="legal" bind:this={extras[2]}>
				<nav aria-label={m.welcome.legal}>
					{#each legal as l (l.href)}<a href={l.href}>{l.label}</a>{/each}
				</nav>
				<a class="unofficial" href="/help/unofficial">{m.welcome.unofficial}</a>
			</footer>
		</div>
	</main>
</SplitStage>

<style>
	.field {
		display: grid;
		grid-template-rows: 1fr auto;
		min-height: 100vh;
		min-height: 100dvh;
		padding: 0 9% 0 8%;
	}
	.docs {
		position: absolute;
		top: var(--space-5);
		right: var(--space-5);
		z-index: 3;
	}
	.home {
		display: grid;
		gap: var(--space-4);
		align-content: center;
		justify-items: start;
		max-width: 34rem;
	}
	.brand {
		font-size: clamp(2.8rem, 1.6rem + 2.6vw, 4.4rem);
		line-height: 1;
	}
	.sub {
		margin-top: calc(-1 * var(--space-2));
		color: var(--bone-dim);
		font-size: 1.15rem;
	}
	.home :global(.go) {
		width: 100%;
		margin-top: var(--space-3);
		justify-content: space-between;
		padding: 0.8em 1.2em;
		font-size: 1.05rem;
	}
	.foot {
		display: grid;
		gap: var(--space-5);
		padding-bottom: var(--space-4);
		transition: opacity var(--duration) var(--easing);
	}
	/* During the hand-off the support and legal rows leave with the welcome. */
	.leaving .foot,
	.leaving .docs {
		opacity: 0;
		pointer-events: none;
	}
	.support {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
	}
	/* A small header between two fading rules. */
	.sup-h {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bone-dim);
	}
	.sup-h::before,
	.sup-h::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--rule-strong));
	}
	.sup-h::after {
		background: linear-gradient(90deg, var(--rule-strong), transparent);
	}
	.sup-row {
		display: flex;
		gap: var(--space-3);
	}
	.legal {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		font-size: var(--size-label);
		text-align: center;
	}
	.legal nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-1) var(--space-4);
	}
	.legal a {
		color: var(--bone-dim);
		text-decoration: none;
	}
	.legal a:hover {
		color: var(--bone);
		text-decoration: underline;
	}
</style>
