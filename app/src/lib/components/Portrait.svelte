<script lang="ts">
	import { sigilFor } from '$lib/sigils';
	import { sealLook, type SealLook } from '$lib/seals';
	import Seal from './Seal.svelte';

	let {
		name,
		portrait = null,
		symbol = null,
		faction = null,
		seal = null,
		size = 56,
		ignite = false,
		igniteDelay = 0
	}: {
		name: string;
		portrait?: string | null;
		symbol?: string | null;
		/** Colours the light that rises through the symbol. */
		faction?: string | null;
		/** The warband's own seal; defaults to its faction's. */
		seal?: SealLook | null;
		size?: number;
		/** Burn the sigil up once on arrival (a battle being declared). */
		ignite?: boolean;
		igniteDelay?: number;
	} = $props();

	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('')
	);
	const sigil = $derived(sigilFor(faction));
	const look = $derived(seal ?? sealLook(faction));
	// Each sigil breathes on its own beat, so a row of them never pulses in unison.
	const phase = $derived([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) / 997);
</script>

<span class="portrait" style:--size="{size}px" title={name}>
	{#if portrait}
		<img src={portrait} alt="" />
	{:else}
		<span class="initials">{initials}</span>
	{/if}
	{#if look}
		<span class="sigil seal-badge">
			<Seal {look} size={Math.round(size * 0.48)} {ignite} {igniteDelay} {phase} />
		</span>
	{:else if symbol}
		<span
			class="sigil"
			class:filigree={sigil.filigree}
			class:ignite
			style:--low={sigil.low}
			style:--high={sigil.high}
			style:--rim={sigil.rim}
			style:--phase="{-phase * 4.2}s"
			style:--delay="{igniteDelay}ms"
		>
			<span class="disc">
				<img src={symbol} alt="" />
				<span class="light"></span>
			</span>
		</span>
	{/if}
</span>

<style>
	.portrait {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		flex: none;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: var(--parchment);
		box-shadow: 0 0 0 2px var(--rule);
	}
	.portrait > img:first-child {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.initials {
		font-family: var(--font-display);
		font-size: calc(var(--size) * 0.42);
		color: var(--blood);
	}

	/* The sigil: the warband's symbol with its faction's light rising through it. */
	.sigil {
		position: absolute;
		right: -6%;
		bottom: -6%;
		width: 42%;
		height: 42%;
	}
	/* The faction's struck seal sits a little proud of the portrait. */
	.seal-badge {
		right: -10%;
		bottom: -10%;
		width: 48%;
		height: 48%;
		border-radius: 50%;
		box-shadow: 0 2px 5px rgba(21, 19, 14, 0.45);
	}
	.seal-badge :global(.seal) {
		display: block;
	}
	.disc {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 50%;
		border: 1.5px solid var(--rim);
		background: var(--night);
		isolation: isolate;
	}
	.disc img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* A steady glow at the foot of the symbol. */
	.disc::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--low), transparent 62%);
		mix-blend-mode: screen;
		opacity: 0.45;
	}
	/* The rising band: starts below the disc, climbs through it, leaves over the top. */
	.light {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		height: 200%;
		background: linear-gradient(
			to top,
			transparent 0%,
			var(--low) 22%,
			var(--high) 38%,
			transparent 54%
		);
		mix-blend-mode: screen;
		opacity: 0.85;
		animation: rise 4.2s cubic-bezier(0.45, 0, 0.55, 1) var(--phase) infinite;
		will-change: transform;
	}
	@keyframes rise {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-100%);
		}
	}

	/* A battle declared: the sigil burns up once, bright, then settles into its breathing. */
	.ignite .light {
		animation:
			ignite 0.9s cubic-bezier(0.16, 1, 0.3, 1) var(--delay) both,
			rise 4.2s cubic-bezier(0.45, 0, 0.55, 1) calc(var(--delay) + 0.9s) infinite;
	}
	.ignite .disc::after {
		animation: flare 1.4s cubic-bezier(0.16, 1, 0.3, 1) var(--delay) both;
	}
	@keyframes ignite {
		from {
			transform: translateY(0);
			opacity: 1;
		}
		to {
			transform: translateY(-100%);
			opacity: 1;
		}
	}
	@keyframes flare {
		from {
			opacity: 0;
		}
		35% {
			opacity: 1;
		}
		to {
			opacity: 0.45;
		}
	}

	/* The Iron Sultanate's gold: a ring of filigree studs turning slowly about the sigil. */
	.filigree .disc {
		border-width: 2px;
	}
	.filigree::before {
		content: '';
		position: absolute;
		inset: -22%;
		border-radius: 50%;
		background: repeating-conic-gradient(var(--rim) 0 7deg, transparent 7deg 30deg);
		mask: radial-gradient(circle, transparent 56%, #000 57%, #000 66%, transparent 67%);
		animation: turn 36s linear infinite;
	}
	@keyframes turn {
		to {
			transform: rotate(1turn);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		/* Still lit, no movement: the band rests across the middle of the symbol. */
		.light,
		.ignite .light {
			animation: none;
			transform: translateY(-62%);
		}
		.filigree::before,
		.ignite .disc::after {
			animation: none;
		}
	}
</style>
