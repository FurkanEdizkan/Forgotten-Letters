<script lang="ts">
	import { onMount } from 'svelte';
	import { SEAL_FRAMES, SEAL_PERIOD, sealLook, type SealLook } from '$lib/seals';

	/**
	 * A struck seal with its light rising through it. The strip is composited in the browser from the
	 * look's metal and light colours, then stepped by CSS (transform only, on the compositor).
	 */
	let {
		look = null,
		faction = null,
		size = 64,
		ignite = false,
		igniteDelay = 0,
		phase = 0,
		label
	}: {
		/** The warband's seal; defaults to its faction's. */
		look?: SealLook | null;
		faction?: string | null;
		size?: number;
		/** Flare once on arrival (a battle being declared). */
		ignite?: boolean;
		igniteDelay?: number;
		/** 0–1 offset into the loop, so neighbouring seals don't pulse in unison. */
		phase?: number;
		label?: string;
	} = $props();

	const resolved = $derived(look ?? sealLook(faction));
	let src = $state<string | null>(null);
	let mounted = $state(false);
	onMount(() => (mounted = true));
	$effect(() => {
		const l = resolved;
		if (!mounted || !l) return;
		let live = true;
		import('$lib/seal-compose').then(({ sealUrl }) => sealUrl(l)).then((u) => live && (src = u));
		return () => (live = false);
	});
</script>

{#if resolved}
	<span
		class="seal"
		class:ignite
		class:ready={!!src}
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
		style:--size="{size}px"
		style:--frames={SEAL_FRAMES}
		style:--period="{SEAL_PERIOD}s"
		style:--phase="{-phase * SEAL_PERIOD}s"
		style:--delay="{igniteDelay}ms"
	>
		<span class="strip" style:background-image={src ? `url(${src})` : `url(${resolved.base})`}></span>
	</span>
{/if}

<style>
	.seal {
		position: relative;
		display: inline-block;
		width: var(--size);
		height: var(--size);
		flex: none;
		overflow: hidden;
		border-radius: 50%;
	}
	.strip {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: calc(100% * var(--frames));
		background-size: 100% 100%;
		opacity: 0.35;
		transition: opacity 0.3s var(--ease-out);
		animation: play var(--period) steps(var(--frames)) var(--phase) infinite;
		will-change: transform;
	}
	/* The coloured strip arrives a moment after the page; until then the bare silver waits, dimmed. */
	.ready .strip {
		opacity: 1;
	}
	@keyframes play {
		to {
			transform: translateX(-100%);
		}
	}
	/* A battle declared: the seal flares up, then keeps its slow rise. */
	.ignite {
		animation: flare 1.2s cubic-bezier(0.16, 1, 0.3, 1) var(--delay) both;
	}
	@keyframes flare {
		from {
			filter: brightness(0.35) saturate(0.6);
			transform: scale(0.86);
		}
		40% {
			filter: brightness(1.9) saturate(1.4);
			transform: scale(1.06);
		}
		to {
			filter: none;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		/* Still lit: the frame where the light stands across the middle. */
		.strip {
			animation: none;
			transform: translateX(calc(-100% * 16 / var(--frames)));
		}
		.ignite {
			animation: none;
		}
	}
</style>
