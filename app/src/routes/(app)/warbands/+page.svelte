<!--
  /warbands: my warbands as cards (name, faction, rating against the limit, problems, campaign seat), "New warband",
  and importing a Trench Companion text export. An import reports what it could not match, with a link to the new
  warband.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import WarbandCard from '#lib/ui/warbands/WarbandCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const w = m.warbands;
	const imp = $derived(resultOf(form, 'import'));
	const done = $derived(
		imp.done as null | { id: string; name: string; unmatched: string[]; ambiguous: string[] }
	);
</script>

<svelte:head><title>{w.title} · {m.app.name}</title></svelte:head>

<div class="head">
	<div>
		<h1>{w.title}</h1>
		<p class="dim">{w.intro}</p>
	</div>
	<Button kind="primary" href="/warbands/new" icon={Plus}>{w.newWarband}</Button>
</div>

{#if data.warbands.length}
	<div class="cards">
		{#each data.warbands as card (card.id)}
			<WarbandCard {card} href="/warbands/{card.id}" />
		{/each}
	</div>
{:else}
	<EmptyState text={w.empty}>
		<Button kind="primary" href="/warbands/new" icon={Plus}>{w.newWarband}</Button>
	</EmptyState>
{/if}

<section class="import">
	<h2>{w.import.title}</h2>
	<p class="dim">{w.import.hint}</p>
	{#if done}
		<Message>
			{w.import.done(done.name)} <a href="/warbands/{done.id}">{w.import.open}</a>
			{#if done.unmatched.length}
				<p>{w.import.unmatched}</p>
				<ul>
					{#each done.unmatched as u, i (i)}<li>{u}</li>{/each}
				</ul>
			{/if}
			{#if done.ambiguous.length}
				<p>{w.import.ambiguous}</p>
				<ul>
					{#each done.ambiguous as u, i (i)}<li>{u}</li>{/each}
				</ul>
			{/if}
		</Message>
	{/if}
	{#if imp.error && !imp.fields.text}<Message kind="danger">{imp.error}</Message>{/if}
	<form
		method="POST"
		action="?/import"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<input type="hidden" name="op" value="import" />
		<TextArea
			label={w.import.text}
			name="text"
			rows={8}
			maxlength={50000}
			error={imp.fields.text}
		/>
		<div class="row">
			{#if data.rules.length}<Select
					label={w.import.rules}
					name="rules"
					options={data.rules}
				/>{/if}
			<Button type="submit">{w.import.submit}</Button>
		</div>
	</form>
</section>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-4);
	}
	.import,
	form {
		display: grid;
		gap: var(--space-3);
		max-width: 52rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-3);
	}
	ul {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-5);
	}
</style>
