<script lang="ts">
	import { onMount } from 'svelte';
	import Portrait from './Portrait.svelte';
	import BattleBrief from './BattleBrief.svelte';
	import { battleBrief, hudRoster } from '$lib/battle-hud';
	import type { Zone } from '$lib/rules/types';
	import type { PublicGame, PublicSnapshot } from '$lib/snapshot';

	/**
	 * The active battle's overview: the stamp, the two warbands pinned to either edge (who, purse, roster), the brief
	 * between them, and ways on (details) and out. While the details page is open (`stepped`), everything but the way
	 * out steps back so the page stands alone over the map. Esc is the page's to handle: it closes details first.
	 */
	let {
		game,
		zone,
		snapshot,
		stepped = false,
		ondetails,
		onleave
	}: {
		game: PublicGame;
		zone: Zone | undefined;
		snapshot: PublicSnapshot;
		stepped?: boolean;
		ondetails: () => void;
		onleave: () => void;
	} = $props();
	// A planned battle: the armies muster under their banners; nothing is fired yet.
	const planned = $derived(game.status === 'scheduled');

	const a = $derived(snapshot.warbands.find((w) => w.id === game.aggressor));
	const d = $derived(snapshot.warbands.find((w) => w.id === game.defender));
	const brief = $derived(zone ? battleBrief({ game, zone, warbands: snapshot.warbands, regions: snapshot.regions }) : null);
	// On a wide screen the brief sits open between the two warbands; narrower, it folds behind a button.
	let briefOpen = $state(false);
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
				.add(root.querySelector('.brief-wrap')!, { opacity: [0, 1], duration: 500 }, 700); // fade only: its transform centres it
		});
		return () => tl?.pause();
	});
</script>

<div class="hud" class:stepped bind:this={root}>
	<div class="vignette" aria-hidden="true"></div>
	<div class="top">
		<p class="stamp" class:planned role="status">{planned ? 'The armies muster' : 'Battle joined'}</p>
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
				{#if !side.w.units.length}
					<p class="empty">No models mustered yet.</p>
				{:else}
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
	<div class="brief-wrap">
		{#if brief}
			<button class="brief-toggle" onclick={() => (briefOpen = !briefOpen)} aria-expanded={briefOpen} aria-controls="battle-brief">
				Battle brief
			</button>
			<div class="brief" class:open={briefOpen} id="battle-brief"><BattleBrief {brief} tone="night" /></div>
		{/if}
	</div>
	<button class="details" onclick={ondetails} tabindex={stepped ? -1 : undefined}>Battle details ›</button>
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
		/* Above the warband pages: an opened brief on a narrow screen lies over them. */
		z-index: 1;
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
		border: 3px double var(--blood-bright);
		color: var(--bone);
		background: rgba(40, 8, 6, 0.78);
		font-family: var(--font-title);
		font-size: clamp(1.6rem, 4vw, 2.6rem);
		letter-spacing: 0.04em;
		transform: rotate(-3deg);
		box-shadow: 0 0 36px rgba(200, 35, 26, 0.35);
	}
	/* Not yet fought: the book's dashed rule for a planned battle, ink rather than blood. */
	.stamp.planned {
		border: 2px dashed var(--bone-dim);
		background: rgba(21, 19, 14, 0.8);
		box-shadow: none;
	}
	/* The battle brief: where, what is played for, and the sky over it. It stands at the foot of the field, in the gap
	   between the two warbands and above the way into the details, so the banners and leaders keep the centre. */
	.brief-wrap {
		position: absolute;
		z-index: 1;
		left: 50%;
		bottom: 64px;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 6px;
		width: min(30rem, calc(100% - 2 * (min(20rem, 30vw) + 28px)));
	}
	.brief-toggle {
		display: none;
		pointer-events: auto;
		padding: 4px 12px;
		background: rgba(21, 19, 14, 0.85);
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.3);
		font-family: var(--font-title);
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.brief {
		pointer-events: auto;
		display: grid;
		gap: 8px;
		width: 100%;
		max-height: 34vh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 10px 14px;
		background: rgba(21, 19, 14, 0.86);
		border-top: 3px solid var(--blood);
	}
	@media (max-width: 60rem) {
		.brief-wrap {
			width: min(26rem, calc(100% - 28px));
		}
		.brief-toggle {
			display: block;
		}
		.brief:not(.open) {
			display: none;
		}
		.brief {
			max-height: calc(100vh - var(--band, 0px) - 220px);
		}
	}
	/* Each warband as a night column pinned to its edge, both starting on the same line under the top
	   row: who they are and their purse at the head, the models they field running down, scrolling inside. */
	.side {
		pointer-events: auto;
		position: absolute;
		top: 64px;
		/* As long as its roster, no longer: an empty warband is a short card, not a column of night. */
		max-height: calc(100% - 64px - 14px);
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(20rem, 30vw);
		padding: 8px 14px 10px 8px;
		background: rgba(21, 19, 14, 0.86);
		border-top: 3px solid var(--blood);
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
		color: var(--blood-pale);
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
	.empty {
		margin: 0;
		color: var(--bone-dim);
		font-style: italic;
		font-size: 0.9rem;
	}
	.cost {
		flex: none;
		font-size: 0.8rem;
		color: var(--bone-dim);
		font-variant-numeric: lining-nums tabular-nums;
	}
	/* The second step: the full paper page for this battle. */
	.details {
		pointer-events: auto;
		position: absolute;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		padding: 7px 16px;
		background: var(--blood);
		color: var(--bone);
		border: 1px solid var(--blood-bright);
		font-family: var(--font-title);
		font-size: 1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
	}
	.details:hover {
		background: var(--blood);
	}
	/* Details open: the overview steps back behind the page; only the way out stays. */
	.top,
	.side,
	.brief-wrap,
	.details,
	.vignette {
		transition:
			opacity 0.25s var(--ease-out),
			visibility 0.25s;
	}
	.hud.stepped .top,
	.hud.stepped .side,
	.hud.stepped .brief-wrap,
	.hud.stepped .details,
	.hud.stepped .vignette {
		opacity: 0;
		visibility: hidden;
	}
	.leave {
		pointer-events: auto;
		position: absolute;
		top: 14px;
		left: 14px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.leave {
		pointer-events: auto;
		min-height: 36px;
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
		/* A phone keeps two slim cards low on either side; rosters and the brief live in the details. */
		.side {
			top: auto;
			bottom: 10px;
			width: 46vw;
			/* Equal cards, so the two start on one line whatever their names. */
			min-height: 124px;
			padding: 6px;
		}
		.brief-wrap {
			display: none;
		}
		.details {
			bottom: 146px;
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
	@media (max-width: 40rem) {
		/* The way out gets its own row above the stamp. */
		.actions {
			left: 10px;
			right: 10px;
			gap: 6px;
		}
		.leave {
			flex: 1;
			font-size: 0.8rem;
		}
		.leave kbd {
			display: none;
		}
		.top {
			top: 62px;
		}
	}
</style>
