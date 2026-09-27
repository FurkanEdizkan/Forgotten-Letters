<script lang="ts">
	import { CONQUEST, GLORY_EXTRAS, resourceTrack } from '$lib/rules/tracker';
	import { RESOURCES, RESOURCE_NAMES, type Resource, type Reward } from '$lib/rules/types';
	import type { PublicWarband } from '$lib/snapshot';
	import Mark from './Mark.svelte';

	let { w, gloryScoring = 'boxIndex' }: { w: PublicWarband; gloryScoring?: string } = $props();

	const BUILDING = { shrine: 'Shrine', vault: 'Vault', depot: 'Depot', garrison: 'Garrison' } as const;
	const ROMAN = ['', 'I', 'II', 'III'];

	function label(r: Reward): string {
		switch (r.t) {
			case 'cvp':
				return `${r.n} CVP`;
			case 'die':
				return '+1 die';
			case 'reroll':
				return 'Reroll';
			case 'set':
				return 'Set';
			case 'explore':
				return `Map ${r.table}`;
			case 'fill':
				return `+${r.track}`;
			case 'fillAny':
				return '+any';
			case 'building':
				return `${BUILDING[r.kind]} ${ROMAN[r.tier]}`;
		}
	}

	/** Serpentine layout: row 1 left→right, row 2 right→left, row 3 left→right. */
	const serpentine = (r: Resource) => {
		const boxes = resourceTrack(r).map((rewards, i) => ({ i, rewards }));
		return [boxes.slice(0, 5), boxes.slice(5, 10).reverse(), boxes.slice(10, 15)];
	};
</script>

<div class="sheet">
	<section class="track">
		<h3>Glory</h3>
		<div class="row">
			{#each GLORY_EXTRAS as extras, i (i)}
				{@const filled = i < w.glory.length}
				<div class="box" class:filled class:first={i === 0}>
					{#if gloryScoring === 'boxIndex'}<span class="top">{i + 1} CVP</span>{/if}
					<span class="val">{filled ? w.glory[i] : ''}</span>
					<span class="rw">{extras.map(label).join(' ')}</span>
				</div>
			{/each}
		</div>
	</section>

	<div class="resources">
		{#each RESOURCES as r (r)}
			<section class="track res-{r}">
				<h3>{RESOURCE_NAMES[r]} <span class="disc">{r}</span> <small>{w.tracks[r]}/15</small></h3>
				{#each serpentine(r) as row, ri (ri)}
					<div class="row five" class:rev={ri === 1}>
						{#each row as b (b.i)}
							<div class="box" class:filled={b.i < w.tracks[r]} class:first={b.i === 0}>
								<span class="val">{#if b.i < w.tracks[r]}<Mark name="strike" size="1.4em" label="Filled" />{/if}</span>
								<span class="rw">{b.rewards.map(label).join(' ')}</span>
							</div>
						{/each}
					</div>
				{/each}
			</section>
		{/each}
	</div>

	<div class="pairs">
		<section class="track">
			<h3>Conquest</h3>
			<div class="row">
				{#each CONQUEST as rewards, i (i)}
					<div class="box" class:filled={i < w.conquest} class:first={i === 0}>
						<span class="val">{#if i < w.conquest}<Mark name="strike" size="1.4em" label="Filled" />{/if}</span>
						<span class="rw">{rewards.map(label).join(' ')}</span>
					</div>
				{/each}
			</div>
		</section>
		<section class="track">
			<h3>Aggression</h3>
			<div class="row">
				{#each Array(12) as _, i (i)}
					<div class="box small" class:filled={i < w.aggression.length} class:first={i === 0}>
						<span class="val">{w.aggression[i] ?? ''}</span>
					</div>
				{/each}
			</div>
		</section>
		<section class="track">
			<h3>Other</h3>
			<div class="row">
				{#each Array(Math.max(12, w.other.length)) as _, i (i)}
					<div class="box small" class:filled={i < w.other.length}>
						<span class="val">{w.other[i] ?? ''}</span>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>

<style>
	/* After the printed Campaign Tracker: heavy ink boxes, soft resource washes, spiky capitals. */
	.sheet {
		display: grid;
		gap: 16px;
		margin-top: 8px;
	}
	.track {
		padding: 12px 14px 10px;
		border: 2px solid var(--ink);
		background: var(--paper);
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 10px;
		padding: 0;
		border: none;
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 1.35rem;
		letter-spacing: 0.08em;
	}
	h3 small {
		margin-left: auto;
		font-family: var(--font-body);
		font-size: 0.85rem;
		letter-spacing: 0;
		color: var(--muted);
		font-variant-numeric: lining-nums;
	}
	.disc {
		display: inline-grid;
		place-items: center;
		width: 1.35em;
		height: 1.35em;
		border-radius: 50%;
		border: 1.5px solid var(--ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 0.72em;
		letter-spacing: 0;
		color: #fff;
		background: var(--c);
	}
	.row {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 6px;
		margin-bottom: 6px;
	}
	.row.five {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}
	.box {
		position: relative;
		display: grid;
		grid-template-rows: auto 1fr auto;
		justify-items: center;
		min-height: 3.6rem;
		padding: 3px 2px;
		border: 2px solid var(--ink);
		/* the printed box's inner line */
		box-shadow: inset 0 0 0 2px var(--paper), inset 0 0 0 3px var(--ink);
		background: var(--paper);
		text-align: center;
	}
	.box.small {
		min-height: 2.4rem;
	}
	.box.first {
		border-width: 3px;
	}
	.top {
		font-size: 0.72rem;
		color: var(--ink-soft);
		font-variant-numeric: lining-nums;
	}
	.val {
		display: grid;
		place-items: center;
		align-self: center;
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--ink);
		font-variant-numeric: lining-nums;
	}
	.box.filled .val {
		color: var(--blood);
	}
	.rw {
		font-size: 0.72rem;
		line-height: 1.1;
		color: var(--ink-soft);
	}
	@media (max-width: 40rem) {
		.box {
			min-height: 4rem;
		}
		.rw {
			font-size: 0.69rem;
			overflow-wrap: anywhere;
		}
	}
	.resources {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	@media (max-width: 40rem) {
		.resources {
			grid-template-columns: 1fr;
		}
	}
	.res-F {
		--c: var(--favour);
	}
	.res-R {
		--c: var(--relics);
	}
	.res-S {
		--c: var(--supplies);
	}
	.res-T {
		--c: var(--territories);
	}
	/* The tracker's quadrant washes: a faint bloom of the resource's colour. */
	.resources .track {
		background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--c) 12%, var(--paper)), var(--paper) 75%);
	}
	.pairs {
		display: grid;
		gap: 16px;
	}
	@media (max-width: 40rem) {
		.row:not(.five) {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
