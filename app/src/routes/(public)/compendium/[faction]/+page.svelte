<script lang="ts">
	import { page } from '$app/state';
	import UnitProfile from '$lib/components/UnitProfile.svelte';
	import KeywordChips from '$lib/components/KeywordChips.svelte';
	import Seal from '$lib/components/Seal.svelte';

	let { data } = $props();
	let filter = $state('');
	const CATS = [
		['elite', 'Elites'],
		['troop', 'Troops'],
		['mercenary', 'Mercenaries']
	] as const;
	const ITEM_CATS = [
		['ranged', 'Ranged Weapons'],
		['grenade', 'Grenades'],
		['melee', 'Melee Weapons'],
		['armour', 'Armour'],
		['shield', 'Shields'],
		['equipment', 'Equipment'],
		['special', 'Special']
	] as const;
	const match = (s: string) => !filter || s.toLowerCase().includes(filter.toLowerCase());
	const variants = $derived([...new Set(data.units.map((u) => u.variant).filter(Boolean))] as string[]);
	/** A Faction Studio faction's own description. */
	const about = $derived((page.data.customFactions as { id: string; description: string | null }[] | undefined)?.find((f) => f.id === data.faction.id)?.description);
</script>

<svelte:head><title>{data.faction.name} · Compendium</title></svelte:head>

<main>
	<nav class="crumbs" aria-label="Breadcrumb"><a href="/compendium">Compendium</a> / {data.faction.name}</nav>
	<header class="head">
		<Seal faction={data.faction.id} size={84} />
		<h1>{data.faction.name}</h1>
	</header>
	{#if about}<p class="about">{about}</p>{/if}
	<input class="filter" bind:value={filter} placeholder="Filter units and battlekit" aria-label="Filter" />

	{#each CATS as [cat, label] (cat)}
		{@const list = data.units.filter((u) => u.category === cat && !u.variant && match(u.name))}
		{#if list.length}
			<h2>{label}</h2>
			<div class="entries">
				{#each list as u (u.id)}<div id={u.id}><UnitProfile unit={u} glossary={data.glossary} picture={u.picture} /></div>{/each}
			</div>
		{/if}
	{/each}

	{#each variants as v (v)}
		{@const list = data.units.filter((u) => u.variant === v && match(u.name))}
		{#if list.length}
			<h2>{v}</h2>
			<div class="entries">
				{#each list as u (u.id)}<div id={u.id}><UnitProfile unit={u} glossary={data.glossary} picture={u.picture} /></div>{/each}
			</div>
		{/if}
	{/each}

	{#if data.items.length}
		<h2>Armoury</h2>
		<p class="note">Items marked • are unique to this faction.</p>
		{#each ITEM_CATS as [cat, label] (cat)}
			{@const list = data.items.filter((i) => i.category === cat && match(i.name))}
			{#if list.length}
				<h3>{label}</h3>
				<table class="armoury">
					<thead><tr><th>Item</th><th>Type</th><th>Range</th><th>Keywords</th><th>Cost</th></tr></thead>
					<tbody>
						{#each list as i (i.id)}
							<tr id="kit-{i.id}">
								<td>
									<strong>{i.unique ? '• ' : ''}{i.name}</strong>
									{#if i.restrictions || i.limit}<small>{[i.restrictions, i.limit ? `Limit ${i.limit}` : null].filter(Boolean).join(' · ')}</small>{/if}
									{#if i.text}<details><summary>Rules</summary><p>{i.text}</p></details>{/if}
								</td>
								<td>{i.type ?? '—'}</td>
								<td>{i.range ?? '—'}</td>
								<td><KeywordChips keywords={i.keywords} glossary={data.glossary} /></td>
								<td class="cost">{i.cost}<small>{i.currency === 'glory' ? ' G' : ' D'}</small></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/each}
	{/if}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 24px clamp(16px, 4vw, 40px) 0;
	}
	.crumbs {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.crumbs a {
		color: inherit;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.head h1 {
		margin: 8px 0;
	}
	.filter {
		width: min(28rem, 100%);
		margin: 6px 0 4px;
	}
	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: 14px;
	}
	.note {
		color: var(--muted);
		margin: 0;
	}
	.armoury {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	.armoury th {
		padding: 4px 8px;
		background: var(--wash-deep);
		text-align: left;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.armoury td {
		padding: 6px 8px;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}
	.armoury td small {
		display: block;
		color: var(--muted);
	}
	.armoury td.cost small {
		display: inline;
	}
	.armoury details summary {
		cursor: pointer;
		font-size: 0.82rem;
		color: var(--blood);
	}
	.armoury details p {
		margin: 4px 0 0;
		max-width: 60ch;
	}
	.cost {
		white-space: nowrap;
		font-weight: 700;
		text-align: right;
		font-variant-numeric: lining-nums;
	}
	@media (max-width: 40rem) {
		.armoury thead {
			display: none;
		}
		.armoury tr {
			display: grid;
			grid-template-columns: 1fr auto;
			padding: 6px 0;
			border-bottom: 1px solid var(--rule);
		}
		.armoury td {
			border: none;
			padding: 2px 4px;
		}
		.armoury td:nth-child(2),
		.armoury td:nth-child(3) {
			display: none;
		}
		.armoury td:nth-child(4) {
			grid-column: 1 / -1;
		}
	}
	.about {
		max-width: 64ch;
		white-space: pre-line;
	}
</style>
