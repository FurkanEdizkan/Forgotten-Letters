<script lang="ts">
	import type { PublicSnapshot } from '$lib/snapshot';
	import type { Zone } from '$lib/rules/types';
	import { weatherByRoll } from '$lib/rules/weather';

	/**
	 * The round of battles, on the live map. Everyone sees its progress (rolls, roles, pairings, battles); a signed-in
	 * player also gets "Your turn" with whatever their warband has to do next. Rolls are made on the server.
	 */
	let {
		snapshot,
		zones,
		mine,
		pickZone = $bindable(null),
		picking = $bindable(false)
	}: {
		snapshot: PublicSnapshot;
		zones: Map<string, Zone>;
		/** Warbands the viewer plays (the Campaign Master sees the round without a turn of their own). */
		mine: string[];
		/** A battlefield chosen by tapping the map while picking. */
		pickZone?: string | null;
		/** True while this viewer is choosing a battlefield: the page routes map taps here. */
		picking?: boolean;
	} = $props();

	const r = $derived(snapshot.round);
	const wb = $derived(new Map(snapshot.warbands.map((w) => [w.id, w])));
	const name = (id: string) => wb.get(id)?.name ?? 'A warband';
	const zoneName = (id: string) => zones.get(id)?.name ?? id;
	const STEP: Record<string, string> = { rolling: 'Rolling for Aggressor', pairing: 'Aggressors pick opponents', battles: 'Battles', closed: 'Closed' };

	let busy = $state(false);
	let problem = $state<string | null>(null);
	/** Send one step; true when it went through (a second tap while one is in flight is ignored). */
	async function act(body: Record<string, unknown>): Promise<boolean> {
		if (busy) return false;
		busy = true;
		problem = null;
		const res = await fetch('/api/round', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
		if (!res?.ok) problem = ((await res?.json().catch(() => null)) as { message?: string } | null)?.message ?? 'That did not go through.';
		busy = false;
		return !!res?.ok;
	}
	/** Pick the opponent and battlefield; keep the opponent chosen if it fails, so only the zone needs choosing again. */
	async function pick(zone: string) {
		if (myPick && opponent && (await act({ op: 'pick', aggressor: myPick, defender: opponent, zone }))) opponent = null;
	}

	// My warbands in this round, and what each has to do.
	const myEntries = $derived(r ? r.entries.filter((e) => mine.includes(e.warbandId)) : []);
	const toRoll = $derived(r?.step === 'rolling' ? myEntries.filter((e) => r.waiting.includes(e.warbandId) || r.reroll.includes(e.warbandId)) : []);
	const myPick = $derived(r?.step === 'pairing' && r.picker && mine.includes(r.picker) ? r.picker : null);
	const myBattles = $derived(snapshot.active.filter((g) => g.roundId === r?.id && (mine.includes(g.aggressor) || mine.includes(g.defender))));

	// Picking: the free opponents and the battlefields open against each (asked of the server when it's my turn).
	let options = $state<{ picker: string; opponents: { id: string; zones: string[] }[] } | null>(null);
	let opponent = $state<string | null>(null);
	$effect(() => {
		if (!myPick) {
			options = null;
			opponent = null;
			picking = false;
			return;
		}
		void r?.battles.length;
		fetch('/api/round')
			.then((res) => (res.ok ? res.json() : null))
			.then((o) => (options = o));
	});
	const openZones = $derived(options?.opponents.find((o) => o.id === opponent)?.zones ?? []);
	$effect(() => {
		picking = !!opponent;
	});
	// A tap on the map picks a battlefield if it is one of the open ones.
	$effect(() => {
		if (pickZone && opponent && myPick && openZones.includes(pickZone) && !busy) {
			const z = pickZone;
			pickZone = null;
			void pick(z);
		} else if (pickZone) pickZone = null;
	});

	const sum = (d: number[] | null | undefined) => (d ? d[0] + d[1] : null);
</script>

{#if r && r.step !== 'closed'}
	<section class="round" aria-label="Round {r.number}">
		<header>
			<strong>Round {r.number}</strong>
			<span>{STEP[r.step]}</span>
		</header>

		{#if toRoll.length || myPick || myBattles.length}
			<div class="turn" role="status">
				<p class="your">Your turn</p>
				{#each toRoll as e (e.warbandId)}
					<button disabled={busy} onclick={() => act({ op: 'roll', warband: e.warbandId })}>
						{r.reroll.includes(e.warbandId) ? 'Tied: roll again' : 'Roll for Aggressor'}{mine.length > 1 ? ` · ${name(e.warbandId)}` : ''}
					</button>
				{/each}

				{#if myPick && options}
					{#if !opponent}
						<p>Pick your opponent{mine.length > 1 ? ` for ${name(myPick)}` : ''}:</p>
						<div class="choices">
							{#each options.opponents as o (o.id)}
								<button class="ghost" onclick={() => (opponent = o.id)}>{name(o.id)}</button>
							{/each}
						</div>
					{:else}
						<p>Against <strong>{name(opponent)}</strong> — pick the battlefield (or tap it on the map):</p>
						<div class="choices">
							{#each openZones as z (z)}
								<button class="ghost" disabled={busy} onclick={() => pick(z)}>{zoneName(z)}</button>
							{:else}
								<p class="hint">No battlefield is open against them: ask the Campaign Master.</p>
							{/each}
						</div>
						<button class="link" onclick={() => (opponent = null)}>← another opponent</button>
					{/if}
				{/if}

				{#each myBattles as g (g.id)}
					{@const me = mine.includes(g.aggressor) ? g.aggressor : g.defender}
					{@const side = me === g.aggressor ? 'aggressor' : 'defender'}
					{@const rolls = g.weatherRolls}
					{@const event = g.weatherEvent ? weatherByRoll(g.weatherEvent) : null}
					<div class="battle">
						<p><strong>{name(g.aggressor)}</strong> <span class="vs">vs</span> <strong>{name(g.defender)}</strong> · {zoneName(g.zone)}</p>
						{#if g.status === 'scheduled'}
							{#if !event && !rolls?.[side]}
								<button disabled={busy} onclick={() => act({ op: 'weather-roll', game: g.id, warband: me })}>Roll Hell on Earth</button>
							{:else if !event && rolls?.aggressor && rolls.defender}
								{#if rolls.chooser === me}
									<p>You choose the weather:</p>
									<div class="choices">
										<button class="ghost" disabled={busy} onclick={() => act({ op: 'weather-choose', game: g.id, pick: 'aggressor' })}>{sum(rolls.aggressor)} · {weatherByRoll(sum(rolls.aggressor) ?? 0)?.name}</button>
										<button class="ghost" disabled={busy} onclick={() => act({ op: 'weather-choose', game: g.id, pick: 'defender' })}>{sum(rolls.defender)} · {weatherByRoll(sum(rolls.defender) ?? 0)?.name}</button>
									</div>
								{:else}
									<p class="hint">{rolls.chooser ? `${name(rolls.chooser)} chooses the weather.` : 'Tied: the Campaign Master settles the roll-off.'}</p>
								{/if}
							{:else if !event}
								<p class="hint">Waiting for {name(side === 'aggressor' ? g.defender : g.aggressor)} to roll.</p>
							{:else}
								<p class="hint">Hell on Earth: <strong>{event.name}</strong></p>
								{#if !g.scenario && zones.get(g.zone)?.archetype && me === g.aggressor}
									<button disabled={busy} onclick={() => act({ op: 'scenario', game: g.id })}>Roll the scenario</button>
								{:else}
									<button disabled={busy} onclick={() => act({ op: 'start', game: g.id })}>Start the battle</button>
								{/if}
							{/if}
						{:else}
							<p class="hint">Being fought. The Campaign Master records the result.</p>
						{/if}
					</div>
				{/each}
				{#if problem}<p class="problem" role="alert">{problem}</p>{/if}
			</div>
		{/if}

		<ol class="entries">
			{#each r.entries as e (e.warbandId)}
				<li class:me={mine.includes(e.warbandId)} class:agg={e.role === 'aggressor'} class:turn={r.picker === e.warbandId}>
					<span class="who">{name(e.warbandId)}</span>
					<span class="dice">{e.rolls.length ? e.rolls.join(' · ') : r.step === 'rolling' ? '…' : ''}</span>
					<span class="role">{e.role === 'aggressor' ? `Aggressor ${e.pickOrder}` : e.role === 'bye' ? 'Sits out' : e.role === 'defender' ? '' : ''}</span>
				</li>
			{/each}
		</ol>
		{#if r.battles.length}
			<ul class="battles">
				{#each r.battles as g (g.id)}
					<li>{name(g.aggressor)} <span class="vs">vs</span> {name(g.defender)} <small>{zoneName(g.zone)}{g.status === 'in_progress' ? ' · fighting' : g.status === 'done' ? ' · done' : ''}</small></li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.round {
		display: grid;
		gap: 8px;
		width: min(20rem, calc(100vw - 28px));
		max-height: calc(100% - var(--band) - 90px);
		overflow-y: auto;
		padding: 10px 12px;
		background: rgba(21, 19, 14, 0.9);
		color: var(--bone);
		border-top: 2px solid var(--blood-bright);
		font-size: 0.9rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	header strong {
		font-family: var(--font-title);
		font-size: 1.1rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	header span {
		color: var(--bone-dim);
	}
	.turn {
		display: grid;
		gap: 6px;
		padding: 8px 10px;
		background: rgba(143, 31, 24, 0.25);
		border-top: 1px solid var(--blood-bright);
	}
	.turn p {
		margin: 0;
	}
	.your {
		font-family: var(--font-title);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ember);
	}
	.turn button:not(.ghost):not(.link) {
		background: #8f1f18;
		color: var(--bone);
		border: 1px solid #b3261e;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.choices .ghost {
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.4);
		background: none;
		font-size: 0.85rem;
	}
	.link {
		justify-self: start;
		padding: 0;
		background: none;
		border: 0;
		color: var(--bone-dim);
		text-decoration: underline;
		font: inherit;
	}
	.battle {
		display: grid;
		gap: 4px;
		padding-top: 6px;
		border-top: 1px solid rgba(236, 229, 211, 0.2);
	}
	.hint {
		color: var(--bone-dim);
	}
	.problem {
		color: var(--ember);
	}
	.vs {
		font-family: var(--font-display);
		color: var(--blood-bright);
	}
	.entries,
	.battles {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.entries li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 8px;
		padding: 3px 0;
		border-bottom: 1px solid rgba(236, 229, 211, 0.12);
	}
	.entries li.me .who {
		font-weight: 700;
	}
	.entries li.agg .role {
		color: var(--ember);
	}
	.entries li.turn {
		background: rgba(143, 31, 24, 0.25);
	}
	.dice {
		font-variant-numeric: lining-nums tabular-nums;
		color: var(--bone-dim);
	}
	.battles li {
		padding: 3px 0;
	}
	.battles small {
		color: var(--bone-dim);
	}
</style>
