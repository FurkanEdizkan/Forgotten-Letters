<!--
  /warbands/new: the new-warband wizard on one page, each choice opening the next: rules version, faction tiles,
  variant, Patron, then name and ducat limit (the faction's starting Ducats unless changed). From a campaign seat
  (?campaign=) the rules are the campaign's and cannot change.
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

	let factionId = $state('');
	let variantId = $state('');
	let patronId = $state('');
	let name = $state('');
	const faction = $derived(data.choices.factions.find((f) => f.id === factionId));
	const variant = $derived(faction?.variants.find((v) => v.id === variantId));
	const patrons = $derived(faction?.patrons[variantId] ?? []);
	const start = $derived(variant?.startDucats ?? faction?.startDucats ?? 0);
	// A new faction or variant starts the limit again from its starting Ducats; typing changes it.
	let limit = $derived(String(start));
	// Another faction or variant serves other Patrons, so the pick starts again.
	const pickFaction = (id: string) => {
		factionId = id;
		variantId = '';
		patronId = '';
	};
	const pickVariant = (id: string) => {
		variantId = id;
		patronId = '';
	};
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
						{
							replace: true,
							reset: false
						}
					)}
			/>
			{#if !data.campaign}<p class="dim small">{w.rulesHint}</p>{/if}
		</div>

		<fieldset>
			<legend>{w.faction}</legend>
			<div class="tiles">
				{#each data.choices.factions as f (f.id)}
					<label class="tile" class:on={factionId === f.id}>
						<input
							type="radio"
							name="factionId"
							value={f.id}
							checked={factionId === f.id}
							onchange={() => pickFaction(f.id)}
						/>
						<span class="tname">{f.name}</span>
						<span class="dim small">{f.alignment} · {w.start(f.startDucats, f.startGlory)}</span>
					</label>
				{/each}
			</div>
			{#if result.fields.factionId}<p class="err">{result.fields.factionId}</p>{/if}
		</fieldset>

		{#if faction && faction.variants.length}
			<fieldset>
				<legend>{w.variant}</legend>
				<div class="tiles">
					<label class="tile" class:on={variantId === ''}>
						<input
							type="radio"
							name="variantId"
							value=""
							checked={variantId === ''}
							onchange={() => pickVariant('')}
						/>
						<span class="tname">{w.noVariant}</span>
					</label>
					{#each faction.variants as v (v.id)}
						<label class="tile" class:on={variantId === v.id}>
							<input
								type="radio"
								name="variantId"
								value={v.id}
								checked={variantId === v.id}
								onchange={() => pickVariant(v.id)}
							/>
							<span class="tname">{v.name}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if faction}
			<fieldset>
				<legend>{w.patron}</legend>
				{#if patrons.length}
					<div class="tiles">
						<label class="tile" class:on={patronId === ''}>
							<input type="radio" name="patronId" value="" bind:group={patronId} />
							<span class="tname">{w.noPatron}</span>
						</label>
						{#each patrons as p (p.id)}
							<label class="tile" class:on={patronId === p.id}>
								<input type="radio" name="patronId" value={p.id} bind:group={patronId} />
								<span class="tname">{p.name}</span>
							</label>
						{/each}
					</div>
				{:else}
					<p class="dim">{w.noPatrons}</p>
				{/if}
				{#if result.fields.patronId}<p class="err">{result.fields.patronId}</p>{/if}
			</fieldset>

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
					label={w.limit}
					name="ducatLimit"
					type="number"
					inputmode="numeric"
					min={0}
					max={100000}
					bind:value={limit}
					hint={w.limitHint(start)}
					error={result.fields.ducatLimit}
				/>
			</div>
			{#if result.error && !Object.keys(result.fields).length}
				<Message kind="danger">{result.error}</Message>
			{/if}
			<div class="row">
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
	legend,
	.tname {
		font-family: var(--font-body);
		font-size: var(--size-title);
		font-weight: 700;
		letter-spacing: var(--track-title);
		text-transform: uppercase;
		color: var(--bone);
	}
	legend {
		margin-bottom: var(--space-2);
	}
	.narrow {
		max-width: 40rem;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-3);
	}
	.tile {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
		cursor: pointer;
	}
	.tile:hover {
		background: var(--panel-hover);
	}
	.tile.on {
		outline: var(--border-focus) solid var(--blood-bright);
	}
	.tile:has(input:focus-visible) {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.tile input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.row:last-child {
		display: flex;
	}
	.small {
		font-size: var(--size-label);
	}
	.err {
		color: var(--bone);
	}
</style>
