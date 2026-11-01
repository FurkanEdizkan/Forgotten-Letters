<!--
  /warbands/new: one list, one click (Trench Companion's new-warband list, our look): each faction with its variants
  underneath, and the Court with its Sins (a dedication, R2). Then the name, the starting Ducats (the ducat limit;
  the banks start full) and Glory, prefilled from the rules and changeable, "Ignore limits" outside a campaign, and
  Create. The Patron is chosen afterwards on the Campaign panel (the book has it chosen after recruiting). From a
  campaign seat (?campaign=) the rules are the campaign's and cannot change.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const w = m.warbands.wizard;
	const result = $derived(resultOf(form, 'create'));

	/** The pick: `<faction>`, `<faction>|v|<variant>` or `<faction>|d|<dedication>`. */
	let pick = $state('');
	let name = $state('');
	const [factionId = '', kind = '', key = ''] = $derived(pick.split('|'));
	const faction = $derived(data.choices.factions.find((f) => f.id === factionId));
	const variant = $derived(kind === 'v' ? faction?.variants.find((v) => v.id === key) : undefined);
	const startD = $derived(variant?.startDucats ?? faction?.startDucats ?? 0);
	const startG = $derived(variant?.startGlory ?? faction?.startGlory ?? 0);
	// A new pick starts the banks again from its starting Ducats and Glory; typing changes them.
	let limit = $derived(String(startD));
	let glory = $derived(String(startG));
</script>

<svelte:head><title>{w.title} · {m.app.name}</title></svelte:head>

<h1>{w.title}</h1>
{#if data.campaign}<p class="dim">{w.forSeat(data.campaign.name)}</p>{/if}

{#if !data.choices.rules.length || data.rulesMissing}
	<Message kind="warn">{w.noRules}</Message>
{:else}
	<form
		method="POST"
		action="?/create"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<input type="hidden" name="op" value="create" />
		<input type="hidden" name="rules" value={data.choices.picked} />
		<input type="hidden" name="factionId" value={factionId} />
		<input type="hidden" name="variantId" value={kind === 'v' ? key : ''} />
		<input type="hidden" name="dedication" value={kind === 'd' ? key : ''} />
		{#if data.campaign}<input type="hidden" name="campaignId" value={data.campaign.id} />{/if}

		<div class="narrow">
			<Select
				label={w.rules}
				name="rulesPick"
				options={data.choices.rules}
				value={data.choices.picked}
				disabled={data.choices.rules.length < 2}
				onchange={(e) =>
					goto(
						`?${data.campaign ? `campaign=${data.campaign.id}&` : ''}rules=${encodeURIComponent((e.currentTarget as HTMLSelectElement).value)}`,
						{ replace: true, reset: false }
					)}
			/>
			{#if !data.campaign}<p class="dim small">{w.rulesHint}</p>{/if}
		</div>

		<fieldset>
			<legend>{w.faction}</legend>
			<div class="fams">
				{#each data.choices.factions as f (f.id)}
					<div class="fam" data-faction={f.id}>
						{#if f.dedications.length}
							<p class="fname">{f.name} <span class="dim small">{w.pickSin}</span></p>
						{:else}
							<label class="opt fname" class:on={pick === f.id}>
								<input type="radio" name="pick" value={f.id} bind:group={pick} />
								{f.name}
								<span class="dim small">{w.start(f.startDucats, f.startGlory)}</span>
							</label>
						{/if}
						{#each f.variants as v (v.id)}
							<label class="opt v" class:on={pick === `${f.id}|v|${v.id}`}>
								<input type="radio" name="pick" value="{f.id}|v|{v.id}" bind:group={pick} />
								{v.name}
							</label>
						{/each}
						{#each f.dedications as d (d.key)}
							<label class="opt v" class:on={pick === `${f.id}|d|${d.key}`}>
								<input type="radio" name="pick" value="{f.id}|d|{d.key}" bind:group={pick} />
								{d.name}
							</label>
						{/each}
					</div>
				{/each}
			</div>
			{#if result.fields.factionId || result.fields.dedication}<p class="err">
					{result.fields.factionId ?? result.fields.dedication}
				</p>{/if}
		</fieldset>

		{#if faction}
			<div class="row narrow">
				<Field
					label={w.name}
					name="name"
					maxlength={80}
					required
					bind:value={name}
					error={result.fields.name}
				/>
				<Field
					label={w.startDucats}
					name="ducatLimit"
					type="number"
					inputmode="numeric"
					min={0}
					max={100000}
					bind:value={limit}
					hint={w.limitHint(startD)}
					error={result.fields.ducatLimit}
				/>
				<Field
					label={w.startGlory}
					name="unspentGlory"
					type="number"
					inputmode="numeric"
					min={0}
					max={10000}
					bind:value={glory}
					error={result.fields.unspentGlory}
				/>
			</div>
			{#if !data.campaign}
				<label class="check"><input type="checkbox" name="ignoreLimits" /> {w.ignoreLimits}</label>
			{/if}
			<p class="dim small">{w.patronLater}</p>
			{#if result.error && !Object.keys(result.fields).length}
				<Message kind="danger">{result.error}</Message>
			{/if}
			<div class="actions">
				<Button kind="primary" type="submit">{w.create}</Button>
				<Button href={data.campaign ? `/campaigns/${data.campaign.id}` : '/warbands'}
					>{w.cancel}</Button
				>
			</div>
		{/if}
	</form>
{/if}

<style>
	form,
	fieldset {
		display: grid;
		gap: var(--space-4);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: var(--space-2);
		font-size: var(--size-title);
		font-weight: 700;
		letter-spacing: var(--track-title);
		text-transform: uppercase;
	}
	.narrow {
		max-width: 52rem;
	}
	.fams {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-3);
		align-items: start;
	}
	.fam {
		display: grid;
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
	}
	.fname {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--panel-raised);
		font-weight: 600;
	}
	.opt {
		display: grid;
		gap: 2px;
		padding: var(--space-2) var(--space-3);
		border-top: var(--border-hairline) solid var(--rule);
		color: var(--bone-dim);
		cursor: pointer;
	}
	.opt.fname {
		border-top: 0;
		color: var(--bone);
	}
	.opt.v {
		padding-left: var(--space-5);
		border-left: 3px solid var(--rule-strong);
	}
	.opt:hover {
		background: var(--panel-hover);
	}
	.opt.on {
		color: var(--bone);
		background: var(--panel-hover);
		border-left-color: var(--blood-bright);
		box-shadow: inset 3px 0 0 var(--blood-bright);
	}
	.opt:has(input:focus-visible) {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: -2px;
	}
	.opt input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: var(--space-4);
		align-items: start;
	}
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.check input {
		accent-color: var(--blood-bright);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
	.small {
		font-size: var(--size-label);
	}
	.err {
		color: var(--bone);
	}
</style>
