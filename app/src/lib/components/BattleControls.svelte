<script lang="ts">
	import { WEATHER, weatherByRoll } from '$lib/rules/weather';
	import type { Zone } from '$lib/rules/types';
	import type { PublicGame, PublicSnapshot } from '$lib/snapshot';

	/** Campaign Master controls for a planned or running battle, shown inside the battlefield panel. */
	let { game, zone, snapshot }: { game: PublicGame; zone: Zone; snapshot: PublicSnapshot } = $props();

	let message = $state('');
	let working = $state(false);
	const name = (id: string | null) => snapshot.warbands.find((w) => w.id === id)?.player ?? '?';
	const rolls = $derived(game.weatherRolls);
	const sum = (d: [number, number] | null) => (d ? d[0] + d[1] : 0);

	async function op(action: string, extra: Record<string, unknown> = {}) {
		if (action === 'cancel' && !confirmCancel) {
			confirmCancel = true;
			return;
		}
		working = true;
		message = '';
		const res = await fetch(`/admin/api/battles/${game.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ op: action, ...extra })
		});
		working = false;
		confirmCancel = false;
		if (!res.ok) message = (await res.json().catch(() => null))?.message ?? 'That did not work.';
	}
	let confirmCancel = $state(false);
</script>

<div class="cm rules-box">
	<h3 class="label">Campaign Master</h3>

	{#if game.status === 'scheduled'}
		<div class="row">
			{#if zone.archetype}
				<button class="ghost" disabled={working} onclick={() => op('roll-scenario')}>🎲 {game.scenario ? 'Re-roll' : 'Roll'} scenario</button>
			{/if}
			<button class="ghost" disabled={working} onclick={() => op('swap')}>⇄ Swap Aggressor</button>
		</div>
	{/if}

	<div class="weather">
		{#if !rolls?.aggressor}
			<button disabled={working} onclick={() => op('roll-weather')}>🎲 Roll Hell on Earth</button>
			<span class="muted">Each player rolls 2D6; the one with fewer CVP picks.</span>
		{:else}
			<span class="muted">
				{rolls.chooser ? `${name(rolls.chooser)} picks:` : 'Tied on CVP — roll off, then pick:'}
			</span>
			<div class="row">
				{#each [{ id: game.aggressor, d: rolls.aggressor }, { id: game.defender, d: rolls.defender }] as r (r.id)}
					{@const w = weatherByRoll(sum(r.d))}
					<button
						class="pick"
						class:chosen={game.weatherEvent === sum(r.d)}
						class:chooser={rolls.chooser === r.id}
						disabled={working}
						onclick={() => op('choose-weather', { event: sum(r.d) })}
					>
						{name(r.id)}: {sum(r.d)} · {w?.name}
					</button>
				{/each}
			</div>
			<div class="row">
				<select value={String(game.weatherEvent ?? '')} onchange={(e) => op('choose-weather', { event: e.currentTarget.value ? Number(e.currentTarget.value) : null })}>
					<option value="">No weather</option>
					{#each WEATHER as w (w.roll)}<option value={String(w.roll)}>{w.roll} · {w.name}</option>{/each}
				</select>
				<button class="ghost" disabled={working} onclick={() => op('roll-weather')}>Roll again</button>
			</div>
		{/if}
	</div>

	<div class="row">
		{#if game.status === 'scheduled'}
			<button disabled={working} onclick={() => op('start')}>▶ Start the battle</button>
		{:else if game.status === 'in_progress'}
			<a class="button" href="/admin/games/{game.id}">Record the result →</a>
		{/if}
		<button class="ghost danger" disabled={working} onclick={() => op('cancel')}>{confirmCancel ? 'Really cancel?' : 'Cancel battle'}</button>
	</div>
	{#if message}<p class="error">{message}</p>{/if}
</div>

<style>
	.cm {
		display: grid;
		gap: 8px;
	}
	.label {
		margin: 0 0 4px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.weather {
		display: grid;
		gap: 6px;
	}
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
	}
	.pick {
		background: var(--paper);
		color: var(--ink);
		border-color: var(--rule);
		font-variant-caps: normal;
		letter-spacing: 0;
	}
	.pick.chooser {
		border-color: var(--blood);
	}
	.pick.chosen {
		background: var(--blood);
		color: var(--parchment);
	}
	.danger {
		color: var(--blood);
	}
	.button {
		padding: 8px 14px;
		background: var(--ink);
		color: var(--parchment);
		text-decoration: none;
		font-variant-caps: small-caps;
		letter-spacing: 0.06em;
	}
	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.error {
		margin: 0;
		color: var(--blood);
	}
</style>
