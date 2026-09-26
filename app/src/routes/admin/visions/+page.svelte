<script lang="ts">
	import { enhance } from '$app/forms';
	import { VISIONS, visionById } from '$lib/rules/visions';

	let { data } = $props();

	const packs = $derived(Math.max(1, Math.ceil(data.warbands.length / 8)));
	let deal = $state<Record<string, [string, string]>>({});

	function shuffle<T>(xs: T[]) {
		const a = [...xs];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	/** Deal 2 cards to each warband without a Vision, from the packs minus cards already kept. */
	function dealCards() {
		const deck: string[] = [];
		for (let p = 0; p < packs; p++) deck.push(...VISIONS.map((v) => v.id));
		for (const w of data.warbands) {
			const i = w.visionCard ? deck.indexOf(w.visionCard) : -1;
			if (i >= 0) deck.splice(i, 1);
		}
		const shuffled = shuffle(deck);
		const next: Record<string, [string, string]> = {};
		for (const w of data.warbands) {
			if (w.visionCard || shuffled.length < 2) continue;
			next[w.id] = [shuffled.pop()!, shuffled.pop()!];
		}
		deal = next;
	}

	const undealt = $derived(data.warbands.filter((w) => !w.visionCard).length);
</script>

<h1>Visions</h1>
<p>
	Each player is dealt 2 Vision cards, keeps 1 in secret and returns the other unseen.
	{data.warbands.length} warbands need {packs} pack{packs > 1 ? 's' : ''}.
</p>

<button onclick={dealCards} disabled={!undealt}>Deal to {undealt} warband{undealt === 1 ? '' : 's'}</button>

<ul>
	{#each data.warbands as w (w.id)}
		<li>
			<span class="who">{w.seat ? `P${w.seat} · ` : ''}{w.player} <small>{w.name}</small></span>
			{#if w.visionCard}
				<span class="kept">Kept: {visionById(w.visionCard)?.name}</span>
			{:else if deal[w.id]}
				<span class="choice">
					{#each deal[w.id] as card, i (i)}
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
