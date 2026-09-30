<script lang="ts">
	import { onMount } from 'svelte';
	import Portrait from './Portrait.svelte';
	import { weatherByRoll } from '$lib/rules/weather';
	import { hudRoster } from '$lib/battle-hud';
	import type { PublicGame, PublicSnapshot } from '$lib/snapshot';

	/** The active battle's overlay: the stamp, the two warbands facing each other (purse and roster), and a way out. */
	let { game, snapshot, zoneName, onleave }: { game: PublicGame; snapshot: PublicSnapshot; zoneName: string; onleave: () => void } = $props();

	const a = $derived(snapshot.warbands.find((w) => w.id === game.aggressor));
	const d = $derived(snapshot.warbands.find((w) => w.id === game.defender));
	const weather = $derived(game.weatherEvent ? weatherByRoll(game.weatherEvent) : null);
	let root: HTMLDivElement;

	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let tl: { pause: () => void } | undefined;
		import('animejs').then(({ createTimeline }) => {
			if (!root) return;
			tl = createTimeline()
				.add(root.querySelector('.stamp')!, { scale: [2.6, 1], rotate: [-12, -3], opacity: [0, 1], duration: 650, ease: 'outExpo' })
				.add(root.querySelector('.side.left')!, { x: ['-120%', '0%'], opacity: [0, 1], duration: 600, ease: 'outCubic' }, 350)
				.add(root.querySelector('.side.right')!, { x: ['120%', '0%'], opacity: [0, 1], duration: 600, ease: 'outCubic' }, 450)
				.add(root.querySelector('.where')!, { opacity: [0, 1], y: [8, 0], duration: 500 }, 700);
		});
		const esc = (e: KeyboardEvent) => e.key === 'Escape' && onleave();
		addEventListener('keydown', esc);
		return () => {
			tl?.pause();
			removeEventListener('keydown', esc);
		};
	});
</script>

<div class="hud" bind:this={root}>
	<div class="vignette" aria-hidden="true"></div>
	<div class="top">
		<p class="stamp" role="status">Battle joined</p>
		<p class="where">{zoneName} · {game.scenario ?? 'Scenario to be rolled'}{weather ? ` · ${weather.name}` : ''}</p>
	</div>
	{#each [{ w: a, cls: 'left', role: 'Aggressor' }, { w: d, cls: 'right', role: 'Defender' }] as side (side.cls)}
		{#if side.w}
			<section class="side {side.cls}" aria-label="{side.role}: {side.w.name}">
				<header>
					<Portrait name={side.w.player} portrait={side.w.portrait} symbol={side.w.symbol} faction={side.w.faction} seal={side.w.seal} size={52} />
					<div class="who">
						<small>{side.role}</small>
						<strong>{side.w.name}</strong>
						<span>{side.w.player}</span>
					</div>
				</header>
				<p class="purse"><span><b>{side.w.treasury.ducats}</b> ducats</span><span><b>{side.w.treasury.glory}</b> glory</span></p>
				{#if side.w.units.length}
					<ol class="roster">
						{#each hudRoster(side.w.units) as u (u.id)}
							<li>
								<span class="unit"
									><strong>{u.name}</strong><small>{u.leader ? `Leader · ${u.type}` : u.type}</small></span
								>
								<span class="cost">{u.cost} {u.currency === 'glory' ? 'glory' : 'ducats'}</span>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		{/if}
	{/each}
	<button class="leave" onclick={onleave}>Leave the battlefield <kbd>Esc</kbd></button>
</div>

<style>
	.hud {
		position: absolute;
		inset: var(--band, 0) 0 0 0;
		pointer-events: none;
		z-index: 4;
	}
	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse 55% 50% at 50% 52%, transparent 45%, rgba(10, 7, 4, 0.72) 100%);
	}
	.top {
		position: absolute;
		top: 14px;
		left: 0;
		right: 0;
		display: grid;
		justify-items: center;
		gap: 6px;
	}
	.stamp {
		margin: 0;
		padding: 4px 18px 2px;
		border: 3px double #c8231a;
		color: #e8d9c0;
		background: rgba(40, 8, 6, 0.78);
		font-family: var(--font-title);
		font-size: clamp(1.6rem, 4vw, 2.6rem);
		letter-spacing: 0.04em;
		transform: rotate(-3deg);
		box-shadow: 0 0 36px rgba(200, 35, 26, 0.35);
	}
	.where {
		margin: 0;
		padding: 2px 12px;
		background: rgba(21, 19, 14, 0.75);
		color: var(--bone);
		font-size: 0.95rem;
	}
	/* Each warband as a night page: who they are, their purse, and the models they field. It grows up
	   from the bottom corner and stops short of the Leave and sky buttons in the top-left. */
	.side {
		pointer-events: auto;
		position: absolute;
		bottom: 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(22rem, 44vw);
		max-height: calc(100% - 128px);
		padding: 8px 14px 10px 8px;
		background: rgba(21, 19, 14, 0.86);
		border-top: 3px solid #8f1f18;
		color: var(--bone);
	}
	.side.left {
		left: 14px;
	}
	.side.right {
		right: 14px;
		padding: 8px 8px 10px 14px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.side.right header {
		flex-direction: row-reverse;
		text-align: right;
	}
	.who {
		display: grid;
		line-height: 1.2;
		min-width: 0;
	}
	.who small,
	.unit small {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #d98c80;
	}
	.who strong {
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 1.2rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.who span {
		font-size: 0.85rem;
		color: var(--bone-dim);
	}
	.purse {
		display: flex;
		gap: 16px;
		margin: 0;
		padding: 4px 0;
		border-block: 1px solid rgba(236, 229, 211, 0.18);
		font-size: 0.9rem;
		color: var(--bone-dim);
		font-variant-numeric: lining-nums tabular-nums;
	}
	.side.right .purse {
		justify-content: flex-end;
	}
	.purse b {
		font-size: 1.15rem;
		color: var(--bone);
	}
	.roster {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		margin: 0;
		padding: 0;
		list-style: none;
		scrollbar-width: thin;
	}
	.roster li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 4px 0;
		border-bottom: 1px solid rgba(236, 229, 211, 0.12);
	}
	.unit {
		display: grid;
		min-width: 0;
		line-height: 1.2;
	}
	.unit strong {
		font-weight: 600;
		font-size: 0.92rem;
	}
	.cost {
		flex: none;
		font-size: 0.8rem;
		color: var(--bone-dim);
		font-variant-numeric: lining-nums tabular-nums;
	}
	.leave {
		pointer-events: auto;
		position: absolute;
		top: 14px;
		left: 14px;
		padding: 6px 12px;
		background: rgba(21, 19, 14, 0.85);
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.3);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.leave:hover {
		border-color: var(--bone);
	}
	kbd {
		font: inherit;
		font-size: 0.75rem;
		opacity: 0.6;
		margin-left: 4px;
	}
	@media (max-width: 640px) {
		.top {
			top: 58px;
		}
		.side {
			bottom: 10px;
			width: 46vw;
			padding: 6px;
		}
		/* Two rosters would bury the battlefield on a phone: keep who and their purse. */
		.side :global(.portrait),
		.roster,
		kbd {
			display: none;
		}
		.purse {
			gap: 10px;
			font-size: 0.8rem;
		}
	}
</style>
