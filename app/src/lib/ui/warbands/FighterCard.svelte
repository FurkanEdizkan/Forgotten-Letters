<!--
  The selected fighter, in the builder's right-hand panel (Trench Companion's fighter detail, our look): picture slot
  (empty until a picture is added), name and entry, cost; base cost, base size and stats; keyword chips (dashed when
  they come from kit, a grant or a fireteam, saying from where); upgrades with "taken / most" and their text; bought
  and fixed Battlekit by category, each category with + (the Equip dialog) and each bought piece with its ⋮ menu;
  the campaign block; the entry's abilities. Its owner renames it here.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { elementHref } from '#lib/rules/text';
	import type { Unit } from '#lib/rules/pack';
	import type { ApiFighter, ApiUpgrade } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import KeywordChip from '#lib/ui/rules/KeywordChip.svelte';
	import { rulesView } from '#lib/ui/rules/context';
	import FighterCampaign, { type PickTable } from './FighterCampaign.svelte';
	import FighterKit from './FighterKit.svelte';
	import FighterPicture from './FighterPicture.svelte';
	import StatBox from './StatBox.svelte';

	type Props = {
		fighter: ApiFighter;
		unit?: Unit;
		upgrades: ApiUpgrade[];
		holders: { id: string; label: string }[];
		tables: PickTable[];
		marks: number[];
		canEdit: boolean;
		canRefund: boolean;
		beyond: boolean;
		form: FormResult;
	};
	let {
		fighter: x,
		unit,
		upgrades,
		holders,
		tables,
		marks,
		canEdit,
		canRefund,
		beyond,
		form
	}: Props = $props();
	const b = m.warbands.builder;
	const view = rulesView();
	const STATS = ['movement', 'ranged', 'melee', 'armour'] as const;
	let renaming = $state(false);

	const title = $derived(x.name ?? x.unitName);
	const edit = $derived(resultOf(form, 'editFighter', x.id));
	const others = $derived(holders.filter((h) => h.id !== x.id));
	$effect(() => {
		if (edit.done) renaming = false;
	});
</script>

<article class="panel" data-panel="fighter" data-fighter={x.id}>
	<header class="pnh">
		<a class="back" href="?sel=warband" aria-label={b.backToWarband}>‹</a>
		<h2>
			{title}{#if x.name}<span class="dim">&nbsp;— {x.unitName}</span>{/if}
		</h2>
		<span class="data r">{m.warbands.money(x.cost.ducats, x.cost.glory)}</span>
	</header>
	<div class="pnb">
		<div class="top">
			<FighterPicture fighter={x} {canEdit} {form} />
			<div class="facts">
				<dl class="meta">
					<dt>{b.entry}</dt>
					<dd><a href={elementHref(view.set, x.unitId)}>{x.unitName}</a></dd>
					{#if unit}
						<dt>{b.baseCost}</dt>
						<dd class="data">{m.warbands.price(unit.cost, unit.currency)}</dd>
						{#if unit.stats.base}<dt>{b.base}</dt>
							<dd class="data">{unit.stats.base}</dd>{/if}
					{/if}
				</dl>
				{#if unit}
					<div class="stats">
						{#each STATS as s (s)}<StatBox
								label={m.rules.stats[s]}
								value={x.stats[s]}
								change={x.statChanges.find((c) => c.stat === s)}
							/>{/each}
					</div>
				{/if}
				{#if x.keywords.length}
					<p class="chips">
						{#each x.keywords as k, i (`${i}:${k.kw}:${k.value ?? ''}`)}<KeywordChip
								id={k.kw}
								label={k.value != null ? null : k.name}
								value={k.value}
								from={k.derived ? k.from : undefined}
							/>{/each}
					</p>
				{/if}
				{#if canEdit}
					{#if renaming}
						<form
							class="rename"
							method="POST"
							action="?/editFighter"
							use:enhance={() =>
								({ update }) =>
									update({ reset: false })}
						>
							<input type="hidden" name="op" value="editFighter" />
							<input type="hidden" name="id" value={x.id} />
							<input type="hidden" name="fid" value={x.id} />
							<input type="hidden" name="version" value={x.version} />
							<label
								>{b.fighterName}
								<input name="name" maxlength="120" value={x.name ?? ''} /></label
							>
							<Button kind="primary" type="submit">{b.save}</Button>
							<Button onclick={() => (renaming = false)}>{m.warbands.wizard.cancel}</Button>
						</form>
					{:else}
						<button class="link" type="button" onclick={() => (renaming = true)}>{b.rename}</button>
					{/if}
				{/if}
			</div>
		</div>

		<FighterKit
			fighter={x}
			{unit}
			{upgrades}
			holders={others}
			{canEdit}
			{canRefund}
			{beyond}
			{form}
		/>

		<FighterCampaign fighter={x} {tables} {marks} {canEdit} {form} />

		{#if unit?.abilities.length}
			<h3 class="sub">{b.abilities}</h3>
			{#each unit.abilities as a (a.name)}
				<details class="ab">
					<summary>{a.name}</summary>
					<p>{a.text}</p>
				</details>
			{/each}
		{/if}
	</div>
</article>

<style>
	.panel {
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.pnh {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) var(--space-4);
		background: var(--blood);
	}
	.pnh h2 {
		margin: 0;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-title);
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
	}
	.pnh .dim {
		color: var(--bone-dim);
		font-weight: 400;
	}
	.back {
		color: var(--bone);
		text-decoration: none;
		font-size: 1.4em;
		line-height: 1;
	}
	.r {
		margin-left: auto;
	}
	.pnb {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4) var(--space-4);
	}
	.top {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		gap: var(--space-4);
	}
	.link {
		color: var(--blood-pale);
		cursor: pointer;
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		text-decoration: underline;
	}
	.facts {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}
	.meta {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0 var(--space-3);
		margin: 0;
	}
	.meta dt {
		color: var(--bone-faint);
	}
	.meta dd {
		margin: 0;
	}
	.meta a {
		color: var(--bone);
	}
	.stats {
		display: flex;
		gap: var(--space-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
	}
	.rename {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: end;
	}
	.rename input {
		display: block;
		height: var(--button-height);
		background: var(--inset);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		padding: 0 var(--space-2);
		font: inherit;
	}
	.sub {
		display: flex;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding-bottom: 2px;
		border-bottom: var(--border-hairline) solid var(--blood);
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.ab p {
		margin: var(--space-1) 0 var(--space-2);
		color: var(--bone-dim);
	}
</style>
