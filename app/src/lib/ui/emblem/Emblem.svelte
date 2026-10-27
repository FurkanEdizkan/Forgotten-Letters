<!--
  The Forgotten Letters emblem: an open-centre cross (four arms that never touch, held by a halo) inside a ring of
  invented arcane glyphs. Our own design, not the Trench Crusade logo. Drawn in the current accent; the ring turns
  counter-clockwise once every 80 s and stands still under reduced motion. Server-rendered: it needs no script.
-->
<script lang="ts">
	import { arcaneRing, RING_CENTRE } from './glyphs';

	type Props = {
		/** CSS width of the emblem, for example "min(80%, 70vh)". The height follows the square view box. */
		size?: string;
		/** An accessible name; without one the emblem is decoration and hidden from screen readers. */
		label?: string;
		/** Turn the ring. Off for static uses (it also stops under reduced motion). */
		spin?: boolean;
		class?: string;
	};
	let { size = '100%', label, spin = true, class: cls = '' }: Props = $props();

	// The seed is fixed, so this is the same on the server and in the browser; computed once per module.
	const ring = arcaneRing();
</script>

<svg
	class="emblem {cls}"
	viewBox="-64 -54 228 228"
	style:width={size}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
>
	<g class="ring" class:spin>
		{#each ring.circles as c, i (i)}
			<circle
				cx={RING_CENTRE.x}
				cy={RING_CENTRE.y}
				r={c.r}
				fill="none"
				stroke="currentColor"
				stroke-width={c.strokeWidth}
				opacity={c.opacity}
				stroke-dasharray={c.dash}
			/>
		{/each}
		{#each ring.glyphs as g, i (i)}
			<path
				d={g.d}
				transform={g.transform}
				fill="none"
				stroke="currentColor"
				stroke-width="1.25"
				stroke-linecap="round"
				opacity="0.9"
			/>
		{/each}
		{#each ring.diamonds as g, i (i)}
			<path d={g.d} transform={g.transform} fill="currentColor" />
		{/each}
	</g>
	<g class="cross">
		<path
			d="M50 0L62 10 56 14 56 22 50 27 44 22 44 14 38 10Z M68 34L76 34 80 28 100 40 80 52 76 46 68 46 63 40Z M56 58L56 112 62 118 50 140 38 118 44 112 44 58 50 53Z M32 46L24 46 20 52 0 40 20 28 24 34 32 34 37 40Z"
			fill="currentColor"
		/>
		<circle cx="50" cy="40" r="19" fill="none" stroke="currentColor" stroke-width="2.6" />
		<path
			d="M50 13V21M69 40H80M50 59V112M20 40H31"
			stroke="rgba(0,0,0,0.4)"
			stroke-width="1.6"
			fill="none"
		/>
	</g>
</svg>

<style>
	.emblem {
		display: block;
		height: auto;
		max-width: 100%;
		color: var(--blood);
		transition: color var(--duration) var(--easing);
		overflow: visible;
	}
	/* fill-box: the ring's own box is centred on the ring, so it turns on its centre, not the cross's. */
	.ring {
		transform-box: fill-box;
		transform-origin: center;
	}
	.spin {
		animation: ccw 80s linear infinite;
	}
	@keyframes ccw {
		to {
			transform: rotate(-360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
