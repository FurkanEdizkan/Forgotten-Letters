<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	/** Campaign Master: plan a battle at this zone from the map. */
	let { zoneId }: { zoneId: string } = $props();

	interface Option {
		id: string;
		player: string;
		name: string;
		seat: number | null;
		busy: boolean;
		games: number;
		aggressions: number;
		legal: boolean;
		reason: string | null;
	}

	let options = $state<Option[] | null>(null);
	let perPlayer = $state(8);
	let aggressor = $state('');
	let defender = $state('');
	let override = $state(false);
	let message = $state('');
	let busy = $state(false);
	let open = $state(false);

	async function load() {
		const res = await fetch(`/admin/api/battles/options?zone=${encodeURIComponent(zoneId)}`);
		if (!res.ok) {
			message = 'Could not load the warbands.';
			return;
		}
		const data = await res.json();
		options = data.warbands;
		perPlayer = data.gamesPerPlayer;
	}

	$effect(() => {
		void zoneId;
		options = null;
		aggressor = defender = message = '';
		if (open) load();
	});

	const free = $derived((options ?? []).filter((o) => !o.busy));
	const aggressors = $derived(free.filter((o) => o.legal || override));
	const defenders = $derived(free.filter((o) => o.id !== aggressor));
	const a = $derived(options?.find((o) => o.id === aggressor));
	const d = $derived(options?.find((o) => o.id === defender));
	const hint = $derived.by(() => {
		if (!a || !d) return '';
		if (a.aggressions === d.aggressions) return 'Tied on Aggression — they should roll off for Aggressor.';
		return a.aggressions < d.aggressions
			? `${a.player} has been Aggressor fewer times.`
			: `${d.player} has been Aggressor fewer times and should normally attack.`;
	});

	async function plan() {
		busy = true;
		message = '';
		const res = await fetch('/admin/api/battles', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ zone: zoneId, aggressor, defender, override })
		});
		busy = false;
		if (!res.ok) message = (await res.json().catch(() => null))?.message ?? 'Could not plan the battle.';
		// On success the live update turns this sheet into the battlefield panel.
	}
</script>

{#if !open}
	<button class="arrange" onclick={() => (open = true)}><Mark name="swords" /> Arrange a battle here</button>
{:else}
	<div class="box">
		<div class="head">Arrange a battle <button class="link" onclick={() => (open = false)}>close</button></div>
		{#if !options}
			<p class="muted">Mustering…</p>
		{:else}
			<label>
				Aggressor
				<select bind:value={aggressor}>
					<option value="">Who attacks?</option>
					{#each aggressors as o (o.id)}
						<option value={o.id}>{o.seat ? `P${o.seat} · ` : ''}{o.player} ({o.aggressions}× Aggressor, {o.games}/{perPlayer}){o.legal ? '' : ' — out of reach'}</option>
					{/each}
				</select>
			</label>
			{#if !aggressors.length}<p class="muted">No free warband can reach this zone. Tick override to allow it anyway.</p>{/if}
			<label>
				Defender
				<select bind:value={defender} disabled={!aggressor}>
					<option value="">Who defends?</option>
					{#each defenders as o (o.id)}
						<option value={o.id}>{o.seat ? `P${o.seat} · ` : ''}{o.player} ({o.aggressions}× Aggressor, {o.games}/{perPlayer})</option>
					{/each}
				</select>
			</label>
			{#if hint}<p class="hint">{hint}</p>{/if}
			<label class="check"><input type="checkbox" bind:checked={override} /> Override the campaign rules (reach, games left)</label>
			<button onclick={plan} disabled={!aggressor || !defender || busy}>Plan the battle</button>
			{#if message}<p class="error">{message}</p>{/if}
			{#if (options ?? []).some((o) => o.busy)}
				<p class="muted small">On the field already: {(options ?? []).filter((o) => o.busy).map((o) => o.player).join(', ')}</p>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.arrange {
		margin-top: 10px;
		background: var(--blood);
		border-color: var(--blood);
	}
	.box {
		display: grid;
		gap: 8px;
		margin-top: 10px;
		padding: 10px;
		border: 1px dashed var(--blood);
		background: var(--parchment);
	}
	.head {
		display: flex;
		justify-content: space-between;
		font-variant-caps: small-caps;
		font-weight: 600;
		color: var(--blood);
	}
	label {
		display: grid;
		gap: 3px;
	}
	.check {
		display: flex;
		gap: 6px;
		align-items: baseline;
	}
	.link {
		padding: 0;
		background: none;
		border: none;
		color: var(--blood);
		text-decoration: underline;
		font-variant-caps: normal;
	}
	.hint {
		margin: 0;
		font-style: italic;
	}
	.muted {
		color: var(--muted);
		margin: 0;
	}
	.small {
		font-size: 0.85rem;
	}
	.error {
		color: var(--blood);
		margin: 0;
	}
</style>
