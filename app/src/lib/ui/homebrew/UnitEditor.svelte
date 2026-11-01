<!--
  One unit of a homebrew set as an editable card: name, category, availability (at least, at most), cost and
  currency, the five stats, keywords (from the base or the set, or a new one by name), abilities in the player's
  own words, fixed kit, and which of the set's armoury lines it may buy from.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import { lineAllows, toggleLine } from '#lib/rules/homebrew';
	import { CURRENCIES, UNIT_CATEGORIES, type RulesSet, type Unit } from '#lib/rules/pack';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import IdChips from './IdChips.svelte';
	import { addKeyword, int, intOrNull, itemOptions, keywordOptions, type Base } from './edit';

	type Props = { unit: Unit; set: RulesSet; base: Base; open?: boolean; onremove: () => void };
	let { unit = $bindable(), set = $bindable(), base, open = false, onremove }: Props = $props();
	const u = m.homebrew.units;
	const STATS = ['movement', 'ranged', 'melee', 'armour', 'base'] as const;
	const categories = UNIT_CATEGORIES.map((c) => ({ value: c, label: u.categories[c]! }));
	const currencies = CURRENCIES.map((c) => ({ value: c, label: u.currencies[c]! }));
	let newKeyword = $state('');

	const lines = $derived(set.armouryLines.filter((l) => l.owner === unit.owner));
	const siblings = $derived(set.units.filter((x) => x.owner === unit.owner).map((x) => x.id));
	const itemName = (id: string) =>
		[...base.items, ...set.items].find((i) => i.id === id)?.name ?? id;

	function toggle(lineId: string) {
		const i = set.armouryLines.findIndex((l) => l.id === lineId);
		set.armouryLines[i] = toggleLine(set.armouryLines[i]!, unit.id, siblings);
	}
</script>

<details class="unit" {open} data-unit={unit.id}>
	<summary>
		<span class="uname">{unit.name || u.newName}</span>
		<span class="dim small">
			{u.categories[unit.category]} · {unit.cost ?? '?'}
			{u.currencies[unit.currency]}
		</span>
	</summary>
	<div class="body">
		<div class="row3">
			<Field label={u.name} name="unitName" maxlength={120} bind:value={unit.name} />
			<Select label={u.category} name="category" options={categories} bind:value={unit.category} />
			<div class="row2">
				<Field
					label={u.cost}
					name="cost"
					type="number"
					min={0}
					bind:value={() => unit.cost, (v) => (unit.cost = int(v) as number)}
				/>
				<Select
					label={u.currency}
					name="currency"
					options={currencies}
					bind:value={unit.currency}
				/>
			</div>
		</div>
		<div class="row2 narrow">
			<Field
				label={u.min}
				name="min"
				type="number"
				min={0}
				bind:value={() => unit.availability.min, (v) => (unit.availability.min = int(v) as number)}
			/>
			<Field
				label={u.max}
				name="max"
				type="number"
				min={0}
				hint={u.maxHint}
				bind:value={
					() => unit.availability.max ?? '', (v) => (unit.availability.max = intOrNull(v))
				}
			/>
		</div>
		<div class="stats">
			{#each STATS as k (k)}
				<Field
					label={u.stats[k]!}
					name={k}
					maxlength={20}
					bind:value={
						() => unit.stats[k] ?? '',
						(v) => {
							if (v) unit.stats[k] = v;
							else delete unit.stats[k];
						}
					}
				/>
			{/each}
		</div>
		<IdChips
			label={u.keywords}
			placeholder={m.homebrew.keywords.pick}
			ids={unit.keywords.map((k) => k.kw)}
			options={keywordOptions(set, base)}
			onadd={(id) => unit.keywords.push({ kw: id })}
			onremove={(i) => unit.keywords.splice(i, 1)}
		>
			{#snippet extra()}
				<input
					aria-label={m.homebrew.keywords.orNew}
					placeholder={m.homebrew.keywords.orNew}
					maxlength={120}
					bind:value={newKeyword}
				/>
				<Button
					icon={Plus}
					disabled={!newKeyword.trim()}
					onclick={() => {
						unit.keywords.push({ kw: addKeyword(set, newKeyword.trim()) });
						newKeyword = '';
					}}>{m.homebrew.keywords.addNew}</Button
				>
			{/snippet}
		</IdChips>
		<fieldset>
			<legend>{u.abilities}</legend>
			{#each unit.abilities as a, i (i)}
				<div class="ability">
					<Field label={u.abilityName} name="abilityName" maxlength={120} bind:value={a.name} />
					<TextArea label={u.abilityText} name="abilityText" rows={2} bind:value={a.text} />
					<button
						type="button"
						class="icon"
						aria-label="{m.homebrew.armoury.remove} {a.name}"
						onclick={() => unit.abilities.splice(i, 1)}><X size={16} aria-hidden={true} /></button
					>
				</div>
			{/each}
			<div>
				<Button icon={Plus} onclick={() => unit.abilities.push({ name: u.abilityName, text: '' })}
					>{u.addAbility}</Button
				>
			</div>
		</fieldset>
		<IdChips
			label={u.fixed}
			placeholder={u.addItem}
			ids={unit.kit.fixed ?? []}
			options={itemOptions(set, base)}
			onadd={(id) => {
				(unit.kit.fixed ??= []).push(id);
				unit.kit.includedInCost = true;
			}}
			onremove={(i) => {
				unit.kit.fixed!.splice(i, 1);
				if (!unit.kit.fixed!.length) {
					delete unit.kit.fixed;
					delete unit.kit.includedInCost;
				}
			}}
		/>
		<p class="dim small">{u.fixedHint}</p>
		<fieldset>
			<legend>{u.allowed}</legend>
			{#if lines.length}
				<div class="lines">
					{#each lines as l (l.id)}
						<label class="check">
							<input
								type="checkbox"
								checked={lineAllows(l, unit.id)}
								onchange={() => toggle(l.id)}
							/>
							{itemName(l.item)}
						</label>
					{/each}
				</div>
			{:else}
				<p class="dim small">{u.allowedNone}</p>
			{/if}
		</fieldset>
		<div class="foot">
			<!-- Nothing is lost until Save, so one press is enough. -->
			<Button kind="danger" icon={X} onclick={onremove}>{u.remove}</Button>
		</div>
	</div>
</details>

<style>
	.unit {
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-left: var(--border-card-top) solid var(--blood);
	}
	summary {
		display: flex;
		gap: var(--space-3);
		align-items: baseline;
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
	}
	.uname {
		font-family: var(--font-display);
	}
	.body {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border-top: var(--border-hairline) solid var(--rule);
	}
	.row2,
	.row3,
	.stats {
		display: grid;
		gap: var(--space-3);
		align-items: start;
	}
	.row2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.row3 {
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 2fr);
	}
	.narrow {
		max-width: 24rem;
	}
	.stats {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}
	fieldset {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: var(--border-hairline) solid var(--rule);
	}
	legend {
		padding: 0 var(--space-1);
		font-size: var(--size-label);
		color: var(--bone-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.ability {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
		gap: var(--space-3);
		align-items: end;
	}
	.lines {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	.check {
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--button-height);
		height: var(--button-height);
		background: none;
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone-dim);
		cursor: pointer;
	}
	.small {
		font-size: var(--size-label);
	}
	.foot {
		display: flex;
		justify-content: flex-end;
	}
</style>
