<script lang="ts">
	import { enhance } from '$app/forms';
	import { visionById } from '$lib/rules/visions';

	let { data, form } = $props();

	const packs = $derived(Math.max(1, Math.ceil(data.warbands.length / 8)));
	// Dealt on the server and kept (warband.visionOffer), so a reload loses nothing and players see their own two.
	const undealt = $derived(data.warbands.filter((w) => !w.visionCard && !w.visionOffer?.length).length);
</script>

<h1>Visions</h1>
<p>
	Each player is dealt 2 Vision cards, keeps 1 in secret and returns the other unseen.
	{data.warbands.length} warbands need {packs} pack{packs > 1 ? 's' : ''}.
</p>

<form method="POST" action="?/deal" use:enhance>
	<button disabled={!undealt}>Deal to {undealt} warband{undealt === 1 ? '' : 's'}</button>
	{#if form && 'dealt' in form}<span class="muted">Dealt to {form.dealt}. Players choose on their Muster page; you can choose for them here.</span>{/if}
</form>

<ul>
	{#each data.warbands as w (w.id)}
		<li>
			<span class="who">{w.seat ? `P${w.seat} · ` : ''}{w.player} <small>{w.name}</small></span>
			{#if w.visionCard}
				<span class="kept">Kept: {visionById(w.visionCard)?.name}</span>
			{:else if w.visionOffer?.length}
				<span class="choice">
					{#each w.visionOffer as card, i (i)}
						<form method="POST" action="?/keep" use:enhance>
							<input type="hidden" name="warband" value={w.id} />
							<input type="hidden" name="card" value={card} />
							<button title={visionById(card)?.levels.join(' / ')}>Keep {visionById(card)?.name}</button>
						</form>
					{/each}
				</span>
			{:else}
				<span class="muted">Awaiting the deal</span>
			{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
		margin-top: 18px;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	small,
	.muted {
		color: var(--muted);
	}
	.choice {
		display: flex;
		gap: 8px;
	}
	.kept {
		color: var(--supplies);
	}
</style>
