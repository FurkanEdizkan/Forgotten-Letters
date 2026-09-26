<script lang="ts">
	import { CONQUEST, GLORY_EXTRAS, resourceTrack } from '$lib/rules/tracker';
	import { RESOURCES, RESOURCE_NAMES, type Resource, type Reward } from '$lib/rules/types';
	import type { PublicWarband } from '$lib/snapshot';

	let { w, gloryScoring = 'boxIndex' }: { w: PublicWarband; gloryScoring?: string } = $props();

	const BUILDING = { shrine: 'Shrine', vault: 'Vault', depot: 'Depot', garrison: 'Garrison' } as const;
	const ROMAN = ['', 'I', 'II', 'III'];

	function label(r: Reward): string {
		switch (r.t) {
			case 'cvp':
				return `${r.n}✠`;
			case 'die':
				return '+1🎲';
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
					{#if gloryScoring === 'boxIndex'}<span class="top">{i + 1}✠</span>{/if}
					<span class="val">{filled ? w.glory[i] : ''}</span>
					<span class="rw">{extras.map(label).join(' ')}</span>
				</div>
			{/each}
		</div>
	</section>

	<div class="resources">
		{#each RESOURCES as r (r)}
			<section class="track res-{r}">
				<h3>{RESOURCE_NAMES[r]} <small>{w.tracks[r]}/15</small></h3>
				{#each serpentine(r) as row, ri (ri)}
					<div class="row five" class:rev={ri === 1}>
						{#each row as b (b.i)}
							<div class="box" class:filled={b.i < w.tracks[r]} class:first={b.i === 0}>
								<span class="val">{b.i < w.tracks[r] ? '✕' : ''}</span>
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
						<span class="val">{i < w.conquest ? '✕' : ''}</span>
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
	.sheet {
		display: grid;
		gap: 14px;
	}
	.track {
		padding: 10px 12px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	h3 {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.3rem;
	}
	h3 small {
		font-family: var(--font-body);
		font-size: 0.7em;
		color: var(--muted);
	}
	.row {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 4px;
		margin-bottom: 4px;
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
		padding: 2px;
		border: 2px solid var(--ink);
		background: var(--paper);
		text-align: center;
	}
	.box.small {
		min-height: 2.2rem;
	}
	.box.first {
		outline: 1px solid var(--ink);
		outline-offset: 2px;
	}
	.box.filled {
		background: #e6d6b3;
	}
	.top {
		font-size: 0.7rem;
		color: var(--muted);
	}
	.val {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--blood);
		align-self: center;
	}
	.rw {
		font-size: 0.62rem;
		line-height: 1.1;
		color: var(--ink-soft);
	}
	.resources {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
		gap: 14px;
	}
	.res-F h3 {
		color: var(--favour);
	}
	.res-R h3 {
		color: var(--relics);
	}
	.res-S h3 {
		color: var(--supplies);
	}
	.res-T h3 {
		color: var(--territories);
	}
	.pairs {
		display: grid;
		gap: 14px;
	}
	@media (max-width: 40rem) {
		.row:not(.five) {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
