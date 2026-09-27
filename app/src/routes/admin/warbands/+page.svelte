<script lang="ts">
	import { enhance } from '$app/forms';
	import Portrait from '$lib/components/Portrait.svelte';
	import WarbandFields from '$lib/components/WarbandFields.svelte';
	import { FACTIONS } from '$lib/rules/factions';
	import { suggestedEntry } from '$lib/seating';

	let { data, form } = $props();

	const factionName = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? id;
	const houseZones = $derived(data.entryZones.some((z) => z.house));
	let formKey = $state(0);
</script>

<h1>Warbands</h1>

{#if data.warbands.length}
	<ul class="roster">
		{#each data.warbands as w (w.id)}
			<li>
				<a href="/admin/warbands/{w.id}">
					<Portrait name={w.player.name} portrait={w.player.portrait} symbol={w.symbol} faction={w.faction} />
					<span class="who">
						<strong>{w.name}</strong>
						<span>{w.player.seat ? `P${w.player.seat} · ` : ''}{w.player.name}</span>
						<small>{w.variant ?? factionName(w.faction)} · {w.entryZone} {w.entryName}</small>
					</span>
					<span class="stats">
						<span>{w.cvp} CVP</span>
						<small>{w.games} games{w.hasVision ? '' : ' · no Vision'}</small>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p><em>No warbands have answered the call yet.</em></p>
{/if}

<section>
	<h2>Muster a warband</h2>
	{#key formKey}
		<form
			method="POST"
			action="?/create"
			enctype="multipart/form-data"
			use:enhance={() =>
				async ({ result, update }) => {
					await update();
					if (result.type === 'success') formKey++;
				}}
		>
			<WarbandFields
				values={form?.values ?? { seat: data.warbands.length + 1, entryZone: suggestedEntry(data.warbands.length + 1, data.expectedPlayers, houseZones) }}
				errors={form?.errors ?? {}}
				entryZones={data.entryZones}
				suggest={(seat) => suggestedEntry(seat, data.expectedPlayers, houseZones)}
			/>
			<button>Add warband</button>
			{#if form?.created}<span class="ok">{form.created} joins the front.</span>{/if}
			{#if form?.message}<span class="error">{form.message}</span>{/if}
		</form>
	{/key}
</section>

<style>
	.roster {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.roster a {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	.roster a:hover {
		border-color: var(--blood);
	}
	.who {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.who small,
	.stats small {
		color: var(--muted);
	}
	.stats {
		display: grid;
		text-align: right;
	}
	section {
		margin-top: 32px;
		padding: 16px 18px;
		border: 1px solid var(--rule);
	}
	h2 {
		margin-top: 0;
	}
	form {
		display: grid;
		gap: 14px;
		justify-items: start;
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
</style>
