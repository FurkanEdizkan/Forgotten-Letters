<!--
  The first-run stage shared by /welcome, /setup and /login: a dark well with the emblem on the left, a lit seam with
  a small diamond, and a fading field on the right that holds the page. `split` is the left column's share in per
  cent; the welcome hand-off animates it (through --split) from the welcome value to the setup value.
-->
<script lang="ts" module>
	/**
	 * Left column shares, in per cent: the welcome split is 1.15fr / 1fr, the setup split 0.8fr / 1.2fr. Sign-in uses
	 * the welcome split. Shared so the hand-off ends exactly where /setup starts.
	 */
	export const SPLIT = { welcome: (1.15 / 2.15) * 100, setup: 40 } as const;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Emblem from './emblem/Emblem.svelte';

	type Props = {
		/** Width of the left column, in per cent of the page. */
		split: number;
		/** CSS width of the emblem inside the left column. */
		emblemSize?: string;
		/** Inline accent tokens for this stage only (the wizard's live preview). */
		accentStyle?: string;
		/** Faint embers behind the right field, so the glass has something to blur. */
		embers?: boolean;
		root?: HTMLElement | null;
		emblem?: HTMLElement | null;
		children: Snippet;
	};
	let {
		split,
		emblemSize = 'min(82%, 78vh)',
		accentStyle,
		embers = true,
		root = $bindable(null),
		emblem = $bindable(null),
		children
	}: Props = $props();
</script>

<div class="stage" bind:this={root} style:--split="{split}%" style={accentStyle}>
	<div class="left">
		<div class="emb" bind:this={emblem}><Emblem size={emblemSize} /></div>
		<span class="seam" aria-hidden="true"></span>
	</div>
	<div class="right" class:embers>
		{@render children()}
	</div>
</div>

<style>
	.stage {
		display: grid;
		grid-template-columns: var(--split) minmax(0, 1fr);
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--inset);
	}
	/* Above the right field, so the seam's glow and diamond cross over onto it. */
	.left {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		min-width: 0;
		background:
			radial-gradient(
				ellipse at 50% 48%,
				color-mix(in srgb, var(--blood) 20%, transparent),
				transparent 62%
			),
			var(--inset);
		box-shadow: inset -2.5em 0 3em -2.5em rgb(0 0 0 / 0.9);
	}
	.emb {
		display: grid;
		place-items: center;
		width: 100%;
	}
	/* The seam: a hairline of accent light down the edge, brightest in the middle, with a diamond at its centre. */
	.seam {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: 0;
		z-index: 2;
		pointer-events: none;
	}
	.seam::before {
		content: '';
		position: absolute;
		top: 4%;
		bottom: 4%;
		left: -0.5px;
		width: 1px;
		background: linear-gradient(
			transparent,
			var(--blood-bright) 18%,
			var(--blood-bright) 82%,
			transparent
		);
		box-shadow: 0 0 0.7em 0.05em color-mix(in srgb, var(--blood-bright) 55%, transparent);
		animation: seam-draw 700ms 150ms var(--easing) both;
	}
	.seam::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		width: 0.6rem;
		height: 0.6rem;
		translate: -50% -50%;
		rotate: 45deg;
		background: var(--night);
		border: var(--border-hairline) solid var(--blood-bright);
		box-shadow: 0 0 0.6em color-mix(in srgb, var(--blood-bright) 60%, transparent);
	}
	@keyframes seam-draw {
		from {
			transform: scaleY(0);
			opacity: 0;
		}
	}
	.right {
		position: relative;
		isolation: isolate;
		display: grid;
		min-width: 0;
		/* clip, not hidden: the embers overhang this box, and a hidden box can still be scrolled when a control inside
		   gets focus mid-transition, which dragged the step out of view. */
		overflow: clip;
		/* Fades from a faint lift at the seam into the near-black of the left, so neither half reads as a flat slab. */
		background:
			radial-gradient(ellipse 70% 90% at 0% 50%, rgb(236 229 211 / 0.055), transparent 70%),
			radial-gradient(ellipse 120% 80% at 100% 100%, rgb(0 0 0 / 0.55), transparent 60%),
			linear-gradient(90deg, var(--night) 0%, var(--inset) 100%);
	}
	/* Embers behind the glass, drifting slowly, so the blur has something to bend. */
	.embers::before {
		content: '';
		position: absolute;
		inset: -20%;
		z-index: -1;
		pointer-events: none;
		background:
			radial-gradient(
				circle at 70% 58%,
				color-mix(in srgb, var(--blood-bright) 20%, transparent),
				transparent 22%
			),
			radial-gradient(circle at 78% 30%, rgb(236 229 211 / 0.08), transparent 18%),
			radial-gradient(
				circle at 60% 85%,
				color-mix(in srgb, var(--blood) 22%, transparent),
				transparent 20%
			);
		animation: drift 22s ease-in-out infinite alternate;
	}
	@keyframes drift {
		to {
			transform: translate(-6%, 4%) rotate(8deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.seam::before,
		.embers::before {
			animation: none;
		}
	}
</style>
