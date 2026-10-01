<script lang="ts">
	import { battleBrief } from '$lib/battle-hud';
	import { RESOURCE_NAMES } from '$lib/rules/types';

	/**
	 * What a battle is fought over, in three parts: the battlefield (resources, outposts, the region's weather), the
	 * scenario, and Hell on Earth with each side's roll. The same brief sits over the night in the battle HUD and on
	 * paper in the battle's details page, so a phone, which has no room for the HUD's, still has all of it.
	 */
	let { brief, tone = 'paper' }: { brief: NonNullable<ReturnType<typeof battleBrief>>; tone?: 'night' | 'paper' } = $props();
</script>

<div class="brief {tone}">
	<section>
		<h3>Battlefield</h3>
		<p><strong>{brief.battlefield.name}</strong> · {brief.battlefield.kind}</p>
		{#if brief.battlefield.resources.length}
			<p class="res">
				{#each brief.battlefield.resources as r (r)}<span class="res-{r}"><span class="disc">{r}</span>{RESOURCE_NAMES[r]}</span>{/each}
			</p>
		{/if}
		{#if brief.battlefield.bonus}<p class="dim">Outpost bonus: {brief.battlefield.bonus}</p>{/if}
		{#if brief.battlefield.holders.length}<p class="dim">Outposts here: {brief.battlefield.holders.join(', ')}</p>{/if}
		{#if brief.battlefield.weather}
			<p><em>{brief.battlefield.weather.region}:</em> <strong>{brief.battlefield.weather.name}</strong> — {brief.battlefield.weather.effect}</p>
		{/if}
	</section>
	<section>
		<h3>Scenario</h3>
		{#if brief.scenario.state === 'rolled'}
			<p class="dim">{brief.scenario.archetype}</p>
			<dl>
				<dt>Deployment</dt>
				<dd>{brief.scenario.deployment}</dd>
				<dt>Victory</dt>
				<dd>{brief.scenario.victory}</dd>
			</dl>
		{:else if brief.scenario.state === 'named'}
			<p><strong>{brief.scenario.name}</strong></p>
		{:else}
			<p class="dim">To be rolled{brief.scenario.archetype ? ` · ${brief.scenario.archetype}` : ''}</p>
		{/if}
	</section>
	<section>
		<h3>Hell on Earth</h3>
		{#if brief.hell}
			<p><strong>{brief.hell.name}.</strong> {brief.hell.effect}</p>
			{#if brief.hell.rolls.length}
				<p class="dim dice">
					{brief.hell.rolls.map((r) => `${r.player} ${r.dice[0]} + ${r.dice[1]} = ${r.total}`).join(' · ')}{brief.hell.chooser
						? ` · ${brief.hell.chooser} chose`
						: ''}
				</p>
			{/if}
		{:else}
			<p class="dim">Not yet rolled.</p>
		{/if}
	</section>
</div>

<style>
	.brief {
		display: grid;
		gap: 8px;
		line-height: 1.35;
	}
	.brief section + section {
		padding-top: 6px;
		border-top: 1px solid var(--line);
	}
	h3 {
		margin: 0 0 2px;
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--head);
	}
	p {
		margin: 2px 0;
	}
	strong {
		color: var(--strong);
	}
	.dim {
		color: var(--dim);
	}
	.dice {
		font-variant-numeric: lining-nums tabular-nums;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1px 10px;
		margin: 2px 0 0;
	}
	dt {
		color: var(--dim);
	}
	dd {
		margin: 0;
		font-weight: 600;
	}
	.res {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.res span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.disc {
		display: inline-grid;
		place-items: center;
		width: 1.4em;
		height: 1.4em;
		border-radius: 50%;
		border: 1px solid var(--line);
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
		background: var(--c);
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
	/* Over the night: bone text, a pale blood for the heads (the deep one goes dull on black). */
	.night {
		--line: rgba(236, 229, 211, 0.18);
		--head: var(--blood-pale);
		--strong: #fff;
		--dim: var(--bone-dim);
		color: var(--bone);
		font-size: 0.85rem;
	}
	/* On the page: ink, with the book's red heads. */
	.paper {
		--line: var(--rule);
		--head: var(--blood);
		--strong: var(--ink);
		--dim: var(--ink-soft);
		color: var(--ink);
	}
</style>
