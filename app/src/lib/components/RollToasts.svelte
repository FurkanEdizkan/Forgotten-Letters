<script lang="ts">
	import type { PlayerRoll } from '$lib/fx/types';

	/** Every player's roll, as it lands, on every map: who, the dice, and what they decide. Several can stack. */
	let { subscribe }: { subscribe: (fn: (t: { kind: string; roll?: PlayerRoll; seed: number }) => void) => () => void } = $props();

	let toasts = $state<{ key: number; roll: PlayerRoll }[]>([]);
	$effect(() =>
		subscribe((t) => {
			if (t.kind !== 'roll' || !t.roll) return;
			const key = t.seed + Math.random();
			toasts = [...toasts.slice(-3), { key, roll: t.roll }];
			setTimeout(() => (toasts = toasts.filter((x) => x.key !== key)), 6000);
		})
	);
	const face = (n: number) => ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n] ?? String(n);
</script>

<div class="toasts" role="log" aria-live="polite">
	{#each toasts as t (t.key)}
		<div class="toast">
			<span class="who">{t.roll.who}</span>
			{#if t.roll.dice.length}
				<span class="dice" aria-label="rolled {t.roll.dice.join(' and ')}">{#each t.roll.dice as d, i (i)}<span class="die">{face(d)}</span>{/each}</span>
				<strong class="total">{t.roll.dice.reduce((a, b) => a + b, 0)}</strong>
			{/if}
			<small>{t.roll.label}</small>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: absolute;
		z-index: 5;
		top: calc(var(--band, 0px) + 14px);
		left: 50%;
		transform: translateX(-50%);
		display: grid;
		gap: 6px;
		justify-items: center;
		pointer-events: none;
	}
	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 14px;
		background: rgba(21, 19, 14, 0.92);
		color: var(--bone);
		border-top: 2px solid var(--blood-bright);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		animation: land 0.45s var(--ease-out, ease-out);
	}
	@keyframes land {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.96);
		}
	}
	.who {
		font-weight: 700;
	}
	.dice {
		display: inline-flex;
		gap: 2px;
		font-size: 1.6rem;
		line-height: 1;
	}
	.total {
		font-family: var(--font-display);
		font-size: 1.3rem;
		color: var(--ember);
	}
	small {
		color: var(--bone-dim);
	}
	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}
	}
</style>
