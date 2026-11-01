<!--
  /warbands: my warbands as cards (name, faction with variant or Sin, rating against the limit, games, problems,
  campaign seat), filtered by faction and campaign and sorted; each card's ⋮ menu opens, copies, exports or deletes
  it. "New warband", and importing a Trench Companion text or a JSON export. An import reports what it could not
  match, with a link to the new warband.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import Menu from '#lib/ui/warbands/Menu.svelte';
	import WarbandCard from '#lib/ui/warbands/WarbandCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const w = m.warbands;
	const imp = $derived(resultOf(form, 'import'));
	const done = $derived(
		imp.done as null | { id: string; name: string; unmatched: string[]; ambiguous: string[] }
	);
	let faction = $state('');
	let campaign = $state('');
	let sort = $state<'name' | 'rating' | 'games'>('name');
	const opt = (xs: [string, string][], all: string) => [
		{ value: '', label: all },
		...[...new Map(xs)].map(([value, label]) => ({ value, label }))
	];
	const factions = $derived(
		opt(
			data.warbands.map((c) => [c.factionId, c.factionName]),
			w.list.allFactions
		)
	);
	const campaigns = $derived(
		opt(
			data.warbands.map((c) =>
				c.seat ? [c.seat.campaignId, c.seat.campaignName] : ['none', w.notSeated]
			),
			w.list.allCampaigns
		)
	);
	const shown = $derived(
		data.warbands
			.filter((c) => !faction || c.factionId === faction)
			.filter((c) => !campaign || (c.seat?.campaignId ?? 'none') === campaign)
			.toSorted((a, b) =>
				sort === 'rating'
					? b.rating.ducats - a.rating.ducats
					: sort === 'games'
						? b.gamesPlayed - a.gamesPlayed
						: a.name.localeCompare(b.name)
			)
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
	<div class="flt">
		<Select label={w.list.faction} name="faction" options={factions} bind:value={faction} />
		<Select label={w.list.campaign} name="campaign" options={campaigns} bind:value={campaign} />
		<Select
			label={w.list.sort}
			name="sort"
			options={[
				{ value: 'name', label: w.list.byName },
				{ value: 'rating', label: w.list.byRating },
				{ value: 'games', label: w.list.byGames }
			]}
			bind:value={sort}
		/>
	</div>
	<div class="cards">
		{#each shown as card (card.id)}
			<WarbandCard {card} href="/warbands/{card.id}">
				{#snippet menu()}
					<Menu label={w.list.menu(card.name)}>
						<a href="/warbands/{card.id}">{w.list.open}</a>
						<form method="POST" action="?/copy" use:enhance>
							<input type="hidden" name="op" value="copy" />
							<input type="hidden" name="id" value={card.id} />
							<button type="submit">{w.list.copy}</button>
						</form>
						<a href="/api/v1/warbands/{card.id}/export?format=text" download>{w.list.exportText}</a>
						<a href="/api/v1/warbands/{card.id}/export?format=json" download>{w.list.exportJson}</a>
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="op" value="remove" />
							<input type="hidden" name="id" value={card.id} />
							<ConfirmButton label={w.list.delete} confirm={w.list.deleteConfirm} />
						</form>
					</Menu>
				{/snippet}
			</WarbandCard>
		{:else}
			<p class="dim">{w.list.noMatch}</p>
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
			<Select
				label={w.import.format}
				name="format"
				options={[
					{ value: 'text', label: w.import.formatText },
					{ value: 'json', label: w.import.formatJson }
				]}
			/>
			<Field
				label={w.import.gamesPlayed}
				name="gamesPlayed"
				type="number"
				min={0}
				max={100}
				hint={w.import.gamesPlayedHint}
				error={imp.fields.gamesPlayed}
			/>
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
	.flt {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
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
