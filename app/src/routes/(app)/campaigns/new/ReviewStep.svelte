<!-- The wizard's Review step: every choice with an Edit link back to its step. -->
<script lang="ts">
	import { m } from '#lib/messages';
	import { dateRange } from '#lib/ui/campaign-facts';
	import type { WizardValues } from './wizard';

	type Props = { v: WizardValues; edit: (step: number) => void };
	let { v, edit }: Props = $props();
	const w = m.campaigns.wizard;
	const rv = w.review;

	const schedule = $derived(
		[
			v.gamesPerPlayer ? m.campaigns.gamesEach(Number(v.gamesPerPlayer)) : null,
			dateRange(v.startsOn || null, v.endsOn || null)
		]
			.filter(Boolean)
			.join(' · ') || rv.notSet
	);
	const on = $derived(v.houseRules.filter((r) => r.on));
	const rules = $derived(
		v.houseRules.length
			? `${rv.rulesOn(v.houseRules.length, on.length)}${on.length ? `: ${on.map((r) => r.name).join(', ')}` : ''}`
			: rv.none
	);
	const rows = $derived([
		{ label: rv.name, value: v.name, step: 0 },
		{ label: rv.kind, value: m.campaigns.kinds[v.kind], step: 0 },
		{ label: rv.description_, value: v.description || rv.none, step: 0 },
		{ label: rv.schedule, value: schedule, step: 1 },
		{ label: rv.visibility, value: m.campaigns.visibility[v.visibility], step: 1 },
		{ label: rv.seats, value: rv.seatsRange(v.seats), step: 2 },
		{ label: rv.rules, value: rules, step: 3 },
		{ label: rv.map, value: rv.mapSkipped, step: null }
	]);
</script>

<dl class="review">
	{#each rows as row (row.label)}
		<div class="row">
			<dt class="label">{row.label}</dt>
			<dd>{row.value}</dd>
			{#if row.step !== null}
				<button type="button" class="edit" onclick={() => edit(row.step)}>
					{w.edit}<span class="visually-hidden"> {row.label}</span>
				</button>
			{:else}<span></span>{/if}
		</div>
	{/each}
</dl>

<style>
	.review {
		margin: 0;
		border-top: var(--border-opening) solid var(--rule-strong);
	}
	.row {
		display: grid;
		grid-template-columns: 10rem minmax(0, 1fr) auto;
		gap: var(--space-4);
		align-items: baseline;
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.edit {
		padding: 0;
		border: 0;
		background: none;
		color: var(--blood-pale);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.edit:hover {
		color: var(--bone);
	}
</style>
