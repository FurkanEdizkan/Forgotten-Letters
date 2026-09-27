<script lang="ts">
	import { onMount } from 'svelte';
	import { weatherByRoll } from '$lib/rules/weather';
	import type { DiceRoll } from '$lib/fx/types';

	/** Hell on Earth dice tumbling over a zone; every open map plays the same roll. */
	let {
		roll,
		zoneName,
		at,
		onclose
	}: { roll: DiceRoll; zoneName: string; at: { x: number; y: number } | null; onclose: () => void } = $props();

	// Face shown towards the viewer for each value (1 front, 6 back, 2 right, 5 left, 3 top, 4 bottom).
	const FACE: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };
	const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
	const faces = [1, 6, 2, 5, 3, 4];

	let settled = $state(false);
	let showResult = $state(false);
	const sides = $derived([
		{ key: 'aggressor', label: 'Aggressor', ...roll.aggressor },
		{ key: 'defender', label: 'Defender', ...roll.defender }
	]);
	const sum = (d: [number, number]) => d[0] + d[1];
	const chooserName = $derived(roll.chooser === roll.aggressor.id ? roll.aggressor.name : roll.chooser === roll.defender.id ? roll.defender.name : null);

	onMount(() => {
		const a = requestAnimationFrame(() => requestAnimationFrame(() => (settled = true)));
		const b = setTimeout(() => (showResult = true), 1700);
		const c = setTimeout(onclose, 12_000);
		return () => {
			cancelAnimationFrame(a);
			clearTimeout(b);
			clearTimeout(c);
		};
	});

	const spin = (value: number, i: number) => {
		const [x, y] = FACE[value];
		const extra = 720 + 360 * ((value + i) % 2);
		return settled ? `rotateX(${x + extra}deg) rotateY(${y + extra}deg)` : `rotateX(${(i * 97) % 360}deg) rotateY(${(i * 53) % 360}deg)`;
	};
	const pos = $derived(
		at
			? `left: clamp(8px, ${at.x}px - 150px, calc(100% - 308px)); top: clamp(60px, ${at.y}px - 190px, calc(100% - 260px));`
			: 'left: calc(50% - 150px); top: 30%;'
	);
</script>

<div class="dice-pop" style={pos} role="dialog" aria-label="Hell on Earth roll at {zoneName}">
	<button class="close" aria-label="Close" onclick={onclose}>×</button>
	<div class="title">Hell on Earth · {zoneName}</div>
	<div class="pairs">
		{#each sides as s, si (s.key)}
			<div class="pair">
				<div class="who">{s.name} <small>{s.label}</small></div>
				<div class="dice">
					{#each s.dice as v, di (di)}
						<div class="scene">
							<div class="cube" style:transform={spin(v, si * 2 + di)} style:transition-delay="{di * 120 + si * 200}ms">
								{#each faces as f (f)}
									<div class="face f{f}">
										{#each Array(9) as _, k (k)}<span class:pip={PIPS[f].includes(k)}></span>{/each}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				{#if showResult}
					{@const w = weatherByRoll(sum(s.dice))}
					<div class="result" class:chooser={roll.chooser === s.id}>
						<strong>{sum(s.dice)}</strong> · {w?.name}
					</div>
				{/if}
			</div>
		{/each}
	</div>
	{#if showResult}
		<p class="pick">{chooserName ? `${chooserName} has fewer CVP and chooses.` : 'Tied on CVP — roll off to choose.'}</p>
	{/if}
</div>

<style>
	.dice-pop {
		position: absolute;
		z-index: 5;
		width: 300px;
		padding: 12px 14px;
		background: rgba(246, 237, 219, 0.97);
		border: 1px solid var(--blood);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
		animation: pop 0.25s ease-out;
	}
	@keyframes pop {
		from {
			transform: scale(0.85);
			opacity: 0;
		}
	}
	.close {
		position: absolute;
		top: 2px;
		right: 4px;
		padding: 0 8px;
		background: none;
		border: none;
		color: var(--ink);
		font-size: 1.2rem;
	}
	.title {
		font-variant-caps: small-caps;
		letter-spacing: 0.1em;
		color: var(--blood);
		font-weight: 600;
		margin-bottom: 8px;
	}
	.pairs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.who {
		font-weight: 600;
		line-height: 1.1;
	}
	.who small {
		display: block;
		font-weight: 400;
		color: var(--muted);
		font-variant-caps: small-caps;
	}
	.dice {
		display: flex;
		gap: 10px;
		margin: 10px 0 6px;
		perspective: 400px;
	}
	.scene {
		width: 40px;
		height: 40px;
	}
	.cube {
		position: relative;
		width: 40px;
		height: 40px;
		transform-style: preserve-3d;
		transition: transform 1.5s cubic-bezier(0.2, 0.8, 0.25, 1);
	}
	.face {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		padding: 5px;
		background: #f4ecdb;
		border: 1.5px solid var(--ink);
		border-radius: 6px;
		backface-visibility: hidden;
	}
	.face span.pip {
		place-self: center;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--blood);
	}
	.f1 {
		transform: rotateY(0deg) translateZ(20px);
	}
	.f6 {
		transform: rotateY(180deg) translateZ(20px);
	}
	.f2 {
		transform: rotateY(90deg) translateZ(20px);
	}
	.f5 {
		transform: rotateY(-90deg) translateZ(20px);
	}
	.f3 {
		transform: rotateX(90deg) translateZ(20px);
	}
	.f4 {
		transform: rotateX(-90deg) translateZ(20px);
	}
	.result {
		padding: 3px 6px;
		background: var(--parchment);
		animation: pop 0.3s ease-out;
	}
	.result.chooser {
		box-shadow: inset 0 0 0 1.5px var(--blood);
	}
	.pick {
		margin: 8px 0 0;
		font-style: italic;
	}
	@media (prefers-reduced-motion: reduce) {
		.cube {
			transition: none;
		}
	}
</style>
