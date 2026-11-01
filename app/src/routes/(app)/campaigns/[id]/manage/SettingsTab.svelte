<!--
  The Settings tab: name, visibility, schedule, description, the rules version (a Carcass Front campaign keeps its
  expansion on top), whether warbands may go beyond their limits, which homebrew sets warbands may be built on (the
  ones the CM can see, and any already allowed), and house rules, saved together with the campaign's
  version. Someone saving over a newer change gets the reload message (409). Read-only once the campaign ends.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { VISIBILITIES, type HouseRule } from '#lib/schemas/campaigns';
	import type { ApiCampaign } from '#lib/api-types';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import HouseRulesEditor from '#lib/ui/HouseRulesEditor.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Message from '#lib/ui/Message.svelte';
	import RadioCards from '#lib/ui/RadioCards.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';

	type Props = {
		campaign: ApiCampaign;
		cores: { value: string; label: string }[];
		homebrew: { id: string; name: string; baseName: string; ownerName: string }[];
		form: FormResult;
	};
	let { campaign, cores, homebrew, form }: Props = $props();
	const hb = m.homebrew.campaign;
	const w = m.campaigns.wizard;
	const st = m.campaigns.manage.settings;

	// The form starts from the saved campaign and keeps what was typed across a failed save.
	const start = () => ({
		name: campaign.name,
		description: campaign.description,
		visibility: campaign.visibility,
		games: campaign.gamesPerPlayer ? String(campaign.gamesPerPlayer) : '',
		startsOn: campaign.startsOn ?? '',
		endsOn: campaign.endsOn ?? '',
		rules: campaign.houseRules.map((r) => ({ ...r })) as HouseRule[],
		rulesSet: campaign.rulesSet,
		homebrew: [...campaign.homebrewSets]
	});
	let v = $state(start());

	const result = $derived(resultOf(form, 'settings'));
	const ended = $derived(campaign.stage === 'ended');
	const options = VISIBILITIES.map((x) => ({
		value: x,
		label: m.campaigns.visibility[x],
		help: x === 'listed' ? w.schedule.listedHelp : w.schedule.privateHelp
	}));
</script>

<form
	method="POST"
	action="?/settings"
	use:enhance={() =>
		({ update }) =>
			update({ reset: false })}
>
	<input type="hidden" name="op" value="settings" />
	<input type="hidden" name="version" value={campaign.version} />
	{#if ended}<p class="dim">{st.ended}</p>{/if}
	<fieldset disabled={ended}>
		<Field
			label={w.basics.name}
			name="name"
			maxlength={80}
			required
			bind:value={v.name}
			error={result.fields.name}
		/>
		<RadioCards
			legend={w.schedule.who}
			name="visibility"
			{options}
			bind:value={v.visibility}
			disabled={ended}
		/>
		<div class="row3">
			<Field
				label={w.schedule.games}
				name="gamesPerPlayer"
				type="number"
				inputmode="numeric"
				min={1}
				max={50}
				bind:value={v.games}
				error={result.fields.gamesPerPlayer}
			/>
			<Field
				label={w.schedule.start}
				name="startsOn"
				type="date"
				bind:value={v.startsOn}
				error={result.fields.startsOn}
			/>
			<Field
				label={w.schedule.end}
				name="endsOn"
				type="date"
				bind:value={v.endsOn}
				error={result.fields.endsOn}
			/>
		</div>
		<TextArea
			label={w.basics.description_}
			name="description"
			maxlength={500}
			bind:value={v.description}
			error={result.fields.description}
		/>
		<h3>{st.rules}</h3>
		<Select label={st.rulesSet} name="rulesSet" options={cores} bind:value={v.rulesSet} />
		<p class="dim small">
			{st.rulesHint}
			{#each campaign.rulesExpansions as e (e)}{st.withExpansion(e)}{/each}
		</p>
		{#if result.fields.rulesSet}<Message kind="danger">{result.fields.rulesSet}</Message>{/if}
		<!-- An unticked box sends nothing; the hidden "false" before it says so. -->
		<input type="hidden" name="allowBeyondLimits" value="false" />
		<Checkbox
			name="allowBeyondLimits"
			label={st.beyond}
			hint={st.beyondHint}
			checked={campaign.allowBeyondLimits}
		/>
		<fieldset class="homebrew">
			<legend>{hb.title}</legend>
			<p class="dim small">{hb.hint}</p>
			<input type="hidden" name="homebrewSets" value={JSON.stringify(v.homebrew)} />
			{#each homebrew as set (set.id)}
				<label class="check">
					<input type="checkbox" value={set.id} bind:group={v.homebrew} />
					<span>{set.name}</span>
					<span class="dim small">{set.baseName ? hb.on(set.baseName) : ''}</span>
				</label>
			{:else}
				<p class="dim small">{hb.none}</p>
			{/each}
			{#if result.fields.homebrewSets}<Message kind="danger">{result.fields.homebrewSets}</Message
				>{/if}
		</fieldset>
		<h3>{w.rules.title}</h3>
		<div class="wide">
			<HouseRulesEditor
				bind:rules={v.rules}
				kind={campaign.kind}
				errors={result.fields}
				disabled={ended}
			/>
		</div>
	</fieldset>
	{#if result.error && !Object.keys(result.fields).length}
		<Message kind="warn">{result.error}</Message>
	{/if}
	{#if result.done}<Message>{st.saved}</Message>{/if}
	{#if !ended}
		<div class="row">
			<Button kind="primary" type="submit">{st.save}</Button>
			<span class="dim small">{st.kindFixed}</span>
		</div>
	{/if}
</form>

<style>
	form,
	fieldset {
		display: grid;
		gap: var(--space-4);
	}
	/* Text fields keep a readable width; the house rule library takes the page's width for its two columns. */
	form > :global(*:not(fieldset)),
	fieldset > :global(*:not(.wide)) {
		max-width: 52rem;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.row3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.homebrew {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: var(--border-hairline) solid var(--rule);
	}
	.homebrew legend {
		padding: 0 var(--space-1);
	}
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.small {
		font-size: var(--size-label);
	}
</style>
