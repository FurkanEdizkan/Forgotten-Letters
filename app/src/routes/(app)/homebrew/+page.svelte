<!--
  /homebrew: my homebrew sets and the ones others shared, as cards; "New homebrew" (a blank faction, a blank
  variant of a faction, a set of items, or a copy of a faction or variant, on any rules set I can see); and
  importing an exported file (picked, or pasted).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { HOMEBREW_STARTS } from '#lib/schemas/homebrew';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import RadioCards from '#lib/ui/RadioCards.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import HomebrewCard from '#lib/ui/homebrew/HomebrewCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const h = m.homebrew;
	const made = $derived(resultOf(form, 'create'));
	const imp = $derived(resultOf(form, 'import'));

	let start = $state('copy');
	let base = $state('');
	let text = $state('');
	$effect.pre(() => {
		if (!data.bases.some((b) => b.value === base)) base = data.bases[0]?.value ?? '';
	});
	const picked = $derived(data.bases.find((b) => b.value === base));
	const ofOptions = $derived(
		start === 'variant'
			? (picked?.factions ?? [])
			: [...(picked?.factions ?? []), ...(picked?.variants ?? [])]
	);
	const starts = HOMEBREW_STARTS.map((s) => ({
		value: s,
		label: h.new.starts[s]!,
		help: h.new.startHelp[s]!
	}));

	async function readFile(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (f) text = await f.text();
	}
</script>

<svelte:head><title>{h.title} · {m.app.name}</title></svelte:head>

<h1>{h.title}</h1>
<p class="dim intro">{h.intro}</p>

<section>
	<h2>{h.mine}</h2>
	{#if data.mine.length}
		<div class="cards">
			{#each data.mine as card (card.id)}<HomebrewCard {card} />{/each}
		</div>
	{:else}
		<EmptyState text={h.empty} />
	{/if}
</section>

<section>
	<h2>{h.shared}</h2>
	{#if data.shared.length}
		<div class="cards">
			{#each data.shared as card (card.id)}<HomebrewCard {card} />{/each}
		</div>
	{:else}
		<p class="dim">{h.sharedEmpty}</p>
	{/if}
</section>

<div class="split">
	<section>
		<h2>{h.new.title}</h2>
		<form
			method="POST"
			action="?/create"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<input type="hidden" name="op" value="create" />
			<Field label={h.new.name} name="name" maxlength={80} required error={made.fields.name} />
			<RadioCards legend={h.new.start} name="start" options={starts} bind:value={start} />
			<Select label={h.new.base} name="base" options={data.bases} bind:value={base} />
			<p class="dim small">{h.new.baseHint}</p>
			{#if start === 'variant' || start === 'copy'}
				<Select
					label={start === 'variant' ? h.new.ofFaction : h.new.of}
					name="of"
					options={ofOptions}
				/>
				{#if made.fields.of}<Message kind="danger">{made.fields.of}</Message>{/if}
			{/if}
			{#if made.error && !Object.keys(made.fields).length}
				<Message kind="danger">{made.error}</Message>
			{/if}
			<div><Button kind="primary" type="submit">{h.new.create}</Button></div>
		</form>
	</section>

	<section>
		<h2>{h.import.title}</h2>
		<p class="dim">{h.import.hint}</p>
		<form
			method="POST"
			action="?/import"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<input type="hidden" name="op" value="import" />
			<label class="file">
				<span class="label">{h.import.file}</span>
				<input type="file" accept=".json,application/json" onchange={readFile} />
			</label>
			<TextArea
				label={h.import.text}
				name="text"
				rows={6}
				bind:value={text}
				error={imp.fields.text}
			/>
			{#if imp.error && !imp.fields.text}
				<Message kind="danger">
					{imp.error}
					{#if Object.keys(imp.fields).length}
						<ul>
							{#each Object.entries(imp.fields) as [k, v] (k)}<li>{v}</li>{/each}
						</ul>
					{/if}
				</Message>
			{/if}
			<div><Button type="submit">{h.import.submit}</Button></div>
		</form>
	</section>
</div>

<style>
	.intro {
		max-width: 52rem;
	}
	section {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-4);
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: var(--space-6);
		align-items: start;
	}
	form {
		display: grid;
		gap: var(--space-3);
	}
	.file {
		display: grid;
		gap: var(--space-1);
	}
	.label {
		font-size: var(--size-label);
		color: var(--bone-dim);
	}
	.small {
		font-size: var(--size-label);
		margin-top: calc(-1 * var(--space-2));
	}
	ul {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-5);
	}
</style>
