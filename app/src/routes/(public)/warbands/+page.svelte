<script lang="ts">
	import Portrait from '$lib/components/Portrait.svelte';
	import { page } from '$app/state';
	import { FACTIONS } from '$lib/rules/factions';

	let { data } = $props();
	let faction = $state('');
	const list = $derived((page.data.snapshot?.warbands ?? []).filter((w: { id: string; faction: string }) => data.ids.includes(w.id) && (!faction || w.faction === faction)));
	const name = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? id;
</script>

<svelte:head><title>Warbands</title></svelte:head>

<main>
	<div class="head">
		<h1>{page.data.isAdmin ? 'Warbands' : 'Your warbands'}</h1>
		{#if data.canFound}<a class="new" href="/warbands/new">New Warband</a>{/if}
	</div>
	<label class="filter">Faction
		<select bind:value={faction}>
			<option value="">All</option>
			{#each FACTIONS as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
		</select>
	</label>
	<ul>
		{#each list as w (w.id)}
			<li>
				<a href="/warbands/{w.id}">
					<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={48} />
					<span><strong>{w.name}</strong><small>{w.player} · {name(w.faction)} · {w.units.length} models · {w.cvp} CVP</small></span>
				</a>
			</li>
		{:else}
			<li class="muted"><em>No warbands here yet.</em></li>
		{/each}
	</ul>
</main>

<style>
	main {
		max-width: 52rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	a.new {
		display: inline-block;
		padding: 7px 16px;
		border: 1px solid var(--blood);
		background: var(--blood);
		color: var(--paper);
		font-weight: 600;
	}
	a.new:hover {
		background: transparent;
		color: var(--blood);
	}
	.filter {
		display: inline-grid;
		gap: 3px;
		margin-bottom: 12px;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}
	li a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 2px;
		border-bottom: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	li a:hover strong {
		color: var(--blood);
	}
	li a span {
		display: grid;
	}
	small,
	.muted {
		color: var(--muted);
	}
</style>
