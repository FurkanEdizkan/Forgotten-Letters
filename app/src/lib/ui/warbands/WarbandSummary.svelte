<!--
  The three summary cards at the top of the builder's left column (Trench Companion's layout, our look): Warband
  (rating against the limit, total value with the Arsenal, models fielded against the next game's field strength,
  problems), Arsenal (the strongbox and what it holds) and Campaign (game, victory points, Threshold, Elites).
  Each opens its panel on the right.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { isActive } from '#lib/warbands/types';

	type Props = { warband: ApiWarband; sel: string };
	let { warband: wb, sel }: Props = $props();
	const b = m.warbands.builder;
	const money = (d: number, g: number) => m.warbands.money(d, g);
	const arsenal = $derived(
		wb.stash.reduce(
			(t, s) => ({ ducats: t.ducats + s.price.ducats, glory: t.glory + s.price.glory }),
			{ ducats: 0, glory: 0 }
		)
	);
	const on = $derived(wb.fighters.filter((x) => isActive(x)));
	const errors = $derived(wb.issues.filter((i) => i.severity === 'error').length);
</script>

<div class="cards">
	<a class="card" class:on={sel === 'warband'} href="?sel=warband" data-card="warband">
		<h2>{b.warbandCard} <span class="r data">{wb.factionName}</span></h2>
		<p>
			<b class="data">{money(wb.rating.ducats, wb.rating.glory)}</b>
			<span class="dim">{m.warbands.ofLimit(wb.ducatLimit)}</span>
		</p>
		<p class="dim">
			{b.totalValue}:
			<span class="data"
				>{money(wb.rating.ducats + arsenal.ducats, wb.rating.glory + arsenal.glory)}</span
			>
			· {b.fielded}:
			<span class="data">{on.length}{wb.nextGame ? ` / ${wb.nextGame.fieldStrength}` : ''}</span>
			· {errors ? m.warbands.problems(errors) : m.warbands.noProblems}
		</p>
	</a>
	<a class="card" class:on={sel === 'arsenal'} href="?sel=arsenal" data-card="arsenal">
		<h2>{b.arsenal} <span class="r data">{money(arsenal.ducats, arsenal.glory)}</span></h2>
		<p class="dim">
			{b.strongbox}: <span class="data">{money(wb.stashDucats, wb.unspentGlory)}</span>
			{#if wb.stash.length}— {wb.stash.map((s) => s.name).join(', ')}{/if}
		</p>
	</a>
	<a class="card" class:on={sel === 'campaign'} href="?sel=campaign" data-card="campaign">
		<h2>
			{b.campaignCard}
			{#if wb.nextGame}<span class="r data">{b.nextGameShort(wb.nextGame.game)}</span>{/if}
		</h2>
		<p class="dim">
			{b.victoryPoints}: <span class="data">{wb.victoryPoints}</span> · {b.gamesPlayed}:
			<span class="data">{wb.gamesPlayed}</span>
			{#if wb.nextGame}· {b.threshold}:
				<span class="data">{m.warbands.price(wb.nextGame.threshold, 'ducats')}</span>{/if}
		</p>
		<p class="dim">{b.elites}: <span class="data">{wb.elites} / 6</span></p>
	</a>
</div>

<style>
	.cards {
		display: grid;
		gap: var(--space-2);
	}
	.card {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		color: var(--bone);
		text-decoration: none;
	}
	.card:hover {
		background: var(--panel-hover);
	}
	.card.on {
		border-color: var(--blood-bright);
		box-shadow: inset 3px 0 0 var(--blood-bright);
	}
	h2 {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--size-heading);
		font-weight: 400;
		letter-spacing: var(--track-title);
		text-transform: uppercase;
	}
	.r {
		margin-left: auto;
		color: var(--bone-dim);
		font: 400 var(--size-label) / 1.4 var(--font-body);
		letter-spacing: 0;
		text-align: right;
		text-transform: none;
	}
	p {
		margin: 0;
	}
	b {
		font-weight: 600;
	}
</style>
