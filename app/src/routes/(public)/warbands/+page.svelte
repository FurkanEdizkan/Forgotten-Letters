<script lang="ts">
	import { enhance } from '$app/forms';
	import Seal from '$lib/components/Seal.svelte';
	import { FACTIONS } from '$lib/rules/factions';

	let { data, form } = $props();
	let faction = $state('');
	let where = $state<'all' | 'campaign' | 'lists'>('all');
	let sort = $state<'newest' | 'name' | 'rating'>('newest');
	const shown = $derived(
		data.warbands
			.filter((w) => (!faction || w.faction === faction) && (where === 'all' || (where === 'campaign') === w.inCampaign))
			.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'rating' ? b.ducats - a.ducats : b.createdAt - a.createdAt))
	);
</script>

<svelte:head><title>Your Warbands</title></svelte:head>

<div class="page tc">
	<main>
		<header>
			<h1>{data.isAdmin ? 'Warbands' : 'Your Warbands'}</h1>
			<a class="new" href="/warbands/new">+ New Warband</a>
		</header>
		<div class="filters">
			<label>Faction
				<select bind:value={faction}>
					<option value="">All</option>
					{#each FACTIONS as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
				</select>
			</label>
			<label>Campaign
				<select bind:value={where}>
					<option value="all">All</option>
					<option value="campaign">Carcass Front</option>
					<option value="lists">No campaign connected</option>
				</select>
			</label>
			<label class="sort">Sort
				<select bind:value={sort}>
					<option value="newest">Newest</option>
					<option value="name">Name</option>
					<option value="rating">Rating</option>
				</select>
			</label>
		</div>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<ul class="cards">
			{#each shown as w (w.id)}
				<li class="card">
					<a class="body" href="/warbands/{w.id}">
						<span class="text">
							<strong>{w.name}</strong>
							<span>{w.variant ?? w.factionName}</span>
							<span class="money">{w.ducats} D | {w.glory} G · {w.models} models</span>
							<span class="camp">{w.inCampaign ? `Carcass Front${w.player && data.isAdmin ? ` · ${w.player}` : ''}` : 'No campaign connected'}</span>
						</span>
						{#if w.seal}<span class="seal"><Seal look={w.seal} size={86} /></span>{/if}
					</a>
					<details class="menu">
						<summary aria-label="Warband menu">⋮</summary>
						<div class="menu-body">
							<a href="/warbands/{w.id}/play">Play Mode</a>
							<a href="/warbands/{w.id}/print" target="_blank" rel="noopener">Print</a>
							<form method="POST" action="/warbands/{w.id}?/duplicate"><button>Duplicate as a new list</button></form>
							{#if !w.inCampaign && (data.mine || data.isAdmin)}
								<form method="POST" action="?/useForCampaign" use:enhance>
									<input type="hidden" name="list" value={w.id} />
									{#if data.isAdmin}
										<select name="target" aria-label="Campaign warband">
											{#each data.warbands.filter((x) => x.inCampaign && x.faction === w.faction) as x (x.id)}<option value={x.id}>{x.name}</option>{/each}
										</select>
									{/if}
									<button>Use for the campaign (replaces its roster)</button>
								</form>
							{/if}
							{#if !w.inCampaign}
								<details class="confirm">
									<summary>Delete list…</summary>
									<form method="POST" action="/warbands/{w.id}?/deleteList"><button class="danger">Delete “{w.name}” for good</button></form>
								</details>
							{/if}
						</div>
					</details>
				</li>
			{:else}
				<li class="empty">No warbands yet. <a href="/warbands/new">Build your first one →</a></li>
			{/each}
		</ul>
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background: radial-gradient(circle at 70% 20%, #2a261d, var(--night) 70%);
		color: var(--bone);
		padding-bottom: 48px;
	}
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 2rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.new {
		padding: 8px 16px;
		background: #8f1f18;
		border: 1px solid #b3261e;
		color: var(--bone);
		text-decoration: none;
		font-weight: 600;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 16px;
		margin: 16px 0;
		padding: 10px 12px;
		background: rgba(38, 35, 30, 0.9);
	}
	.filters label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.88rem;
	}
	.filters .sort {
		margin-left: auto;
	}
	select {
		background: #14120e;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.25);
		padding: 4px 6px;
		font: inherit;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		gap: 12px;
	}
	.card {
		position: relative;
		background: rgba(38, 35, 30, 0.94);
		border: 1px solid rgba(236, 229, 211, 0.1);
	}
	.body {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 44px 14px 16px;
		color: inherit;
		text-decoration: none;
		min-height: 7rem;
	}
	.body:hover {
		background: rgba(236, 229, 211, 0.04);
	}
	.text {
		display: grid;
		align-content: start;
		gap: 2px;
		font-size: 0.9rem;
	}
	.text strong {
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1.3rem;
	}
	.money {
		font-weight: 600;
	}
	.camp {
		opacity: 0.7;
	}
	.seal {
		flex: none;
		align-self: center;
	}
	.menu {
		position: absolute;
		top: 8px;
		right: 6px;
	}
	.menu > summary {
		list-style: none;
		cursor: pointer;
		padding: 2px 10px;
		font-size: 1.2rem;
	}
	.menu > summary::-webkit-details-marker {
		display: none;
	}
	.menu-body {
		position: absolute;
		right: 0;
		top: 100%;
		z-index: 10;
		display: grid;
		gap: 2px;
		min-width: 16rem;
		padding: 6px;
		background: #2e2a24;
		border: 1px solid rgba(236, 229, 211, 0.12);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
	}
	.menu-body a,
	.menu-body button,
	.menu-body summary {
		display: block;
		width: 100%;
		padding: 6px 10px;
		background: none;
		border: 0;
		color: var(--bone);
		font: inherit;
		font-size: 0.9rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.menu-body a:hover,
	.menu-body button:hover {
		background: rgba(236, 229, 211, 0.08);
	}
	.menu-body form {
		display: grid;
		gap: 4px;
	}
	.danger {
		color: #ff9b8f !important;
	}
	.empty {
		padding: 20px;
		opacity: 0.8;
	}
	.empty a {
		color: var(--bone);
	}
	.error {
		color: #ff9b8f;
	}
</style>
