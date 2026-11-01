<!--
  The homebrew editor's Faction rules tab: for a faction its name, alignment, starting Ducats and Glory, fireteams,
  warband limits (a unit and at most how many) and its rules in the player's own words; for a variant the faction
  it varies and the same rules where they differ (empty: as the faction). A set of items only has its name.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import { ALIGNMENTS, type Faction, type RulesSet, type Variant } from '#lib/rules/pack';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import { int, type Base } from './edit';

	type Props = { set: RulesSet; base: Base; name: string };
	let { set = $bindable(), base, name = $bindable() }: Props = $props();
	const f = m.homebrew.faction;

	const faction = $derived(set.factions[0] as Faction | undefined);
	const variant = $derived(set.variants[0] as Variant | undefined);
	/** The rules this tab edits: the faction's own, or the variant's overrides (the editor gives it `rules: {}`). */
	const rules = $derived((faction ?? variant?.rules) as Partial<Faction> | undefined);
	const owner = $derived(faction?.id ?? variant?.faction);
	const units = $derived(
		[...base.units.filter((u) => u.owner === owner), ...set.units].map((u) => ({
			value: u.id,
			label: u.name
		}))
	);
	const alignments = ALIGNMENTS.map((a) => ({ value: a, label: f.alignments[a]! }));
	const factions = $derived(base.factions.map((x) => ({ value: x.id, label: x.name })));
	const head = $derived(faction ?? variant);
</script>

<div class="tab">
	{#if !head}
		<Field label={f.name} name="setName" maxlength={80} bind:value={name} />
		<p class="dim">{f.items}</p>
	{:else}
		<div class="row2">
			<Field label={f.name} name="headName" maxlength={120} bind:value={head.name} />
			{#if faction}
				<Select
					label={f.alignment}
					name="alignment"
					options={alignments}
					bind:value={faction.alignment}
				/>
			{:else if variant}
				<Select
					label={f.baseFaction}
					name="faction"
					options={factions}
					bind:value={variant.faction}
				/>
			{/if}
		</div>
		{#if rules}
			<div class="row3">
				<Field
					label={f.startDucats}
					name="startDucats"
					type="number"
					min={0}
					hint={variant ? f.sameAsFaction : undefined}
					bind:value={() => rules.startDucats, (v) => (rules.startDucats = int(v))}
				/>
				<Field
					label={f.startGlory}
					name="startGlory"
					type="number"
					min={0}
					hint={variant ? f.sameAsFaction : undefined}
					bind:value={() => rules.startGlory, (v) => (rules.startGlory = int(v))}
				/>
				<Field
					label={f.fireteams}
					name="fireteams"
					type="number"
					min={0}
					hint={variant ? f.sameAsFaction : undefined}
					bind:value={() => rules.fireteams, (v) => (rules.fireteams = int(v))}
				/>
			</div>
			<fieldset class="limits">
				<legend>{f.limits}</legend>
				<p class="dim small">{f.limitsHint}</p>
				{#each rules.caps ?? [] as cap, i (i)}
					<div class="cap">
						<Select label={f.unit} name="capUnit" options={units} bind:value={cap.unit} />
						<Field
							label={f.max}
							name="capMax"
							type="number"
							min={0}
							bind:value={() => cap.max, (v) => (cap.max = int(v) as number)}
						/>
						<button
							type="button"
							class="icon"
							aria-label="{m.homebrew.armoury.remove} {i + 1}"
							onclick={() => {
								rules.caps!.splice(i, 1);
								if (!rules.caps!.length) delete rules.caps;
							}}><X size={16} aria-hidden={true} /></button
						>
					</div>
				{/each}
				<div>
					<Button
						icon={Plus}
						disabled={!units.length}
						onclick={() => (rules.caps ??= []).push({ unit: units[0]!.value, max: 1 })}
						>{f.addLimit}</Button
					>
				</div>
			</fieldset>
		{/if}
		<TextArea
			label={f.text}
			name="text"
			rows={6}
			maxlength={20000}
			bind:value={() => head.text ?? '', (v) => (head.text = v || undefined)}
		/>
		<p class="dim small">{f.textHint}</p>
	{/if}
</div>

<style>
	.tab {
		display: grid;
		gap: var(--space-4);
		max-width: 60rem;
	}
	.row2,
	.row3 {
		display: grid;
		gap: var(--space-4);
		align-items: start;
	}
	.row2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.row3 {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.limits {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-3);
		border: var(--border-hairline) solid var(--rule);
	}
	legend {
		padding: 0 var(--space-1);
		font-family: var(--font-display);
	}
	.cap {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
		gap: var(--space-3);
		align-items: end;
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
</style>
