<script lang="ts">
	import { onMount } from 'svelte';
	import Seal from './Seal.svelte';
	import { FACTIONS } from '$lib/rules/factions';
	import { TIER_NAMES } from '$lib/battle-outcome';
	import type { BattleResultEvent } from '$lib/fx/types';

	/** The line that lands once a battle's monument has risen: who triumphed, where, and how. */
	let { battle, onclose }: { battle: BattleResultEvent; onclose: () => void } = $props();

	const o = $derived(battle.outcome);
	const winner = $derived(o.winner === battle.aggressor.id ? battle.aggressor : o.winner === battle.defender.id ? battle.defender : null);
	const faction = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? 'The victors';
	const fell = $derived(o.fallen.aggressor + o.fallen.defender);
	let root: HTMLDivElement;

	onMount(() => {
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let tl: { pause: () => void } | undefined;
		if (!still)
			import('animejs').then(({ createTimeline, stagger }) => {
				if (!root) return;
				tl = createTimeline({ delay: 3400 })
					.add(root, { opacity: [0, 1], y: [24, 0], duration: 500, ease: 'outCubic' })
					.add(root.querySelectorAll('.word'), { opacity: [0, 1], y: [14, 0], rotate: [-4, 0], delay: stagger(70), duration: 420, ease: 'outBack' }, 150)
					.add(root.querySelector('.detail')!, { opacity: [0, 1], duration: 500 }, '+=100');
			});
		const t = setTimeout(onclose, still ? 8000 : 12500);
		return () => {
			tl?.pause();
			clearTimeout(t);
		};
	});
</script>

<div class="banner" class:draw={o.draw} role="status" bind:this={root}>
	{#if winner}<Seal faction={winner.faction} size={56} ignite />{/if}
	<div>
		<p class="title">
			{#each (winner ? `${faction(winner.faction)} triumph at ${battle.zoneName}` : `Neither side holds ${battle.zoneName}`).split(' ') as w, i (i)}<span class="word">{w}</span>{' '}{/each}
		</p>
		<p class="detail">
			{#if winner}{winner.name} · {TIER_NAMES[o.tier]}{o.margin ? ` by ${o.margin}` : ''}{:else}A draw{/if}{fell ? ` · ${fell} fell` : ''}
		</p>
	</div>
	<button class="close" aria-label="Dismiss" onclick={onclose}>×</button>
</div>

<style>
	.banner {
		position: absolute;
		left: 50%;
		bottom: 88px;
		translate: -50% 0;
		z-index: 6;
		display: flex;
		align-items: center;
		gap: 14px;
		max-width: min(92vw, 40rem);
		padding: 10px 44px 10px 14px;
		background: rgba(21, 19, 14, 0.92);
		border-top: 3px solid #c8231a;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
		color: var(--bone);
	}
	.banner.draw {
		border-top-color: var(--bone-dim);
	}
	p {
		margin: 0;
	}
	.title {
		font-family: var(--font-title);
		font-size: clamp(1.3rem, 3.4vw, 2rem);
		line-height: 1.1;
	}
	.word {
		display: inline-block;
	}
	.detail {
		color: var(--bone-dim);
		font-size: 0.95rem;
	}
	/* Hidden until the timeline brings them in (after the monument has risen). */
	.banner,
	.word,
	.detail {
		opacity: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.banner,
		.word,
		.detail {
			opacity: 1;
		}
	}
	.close {
		position: absolute;
		top: 4px;
		right: 8px;
		background: none;
		border: 0;
		color: var(--bone-dim);
		font-size: 1.4rem;
		cursor: pointer;
	}
</style>
