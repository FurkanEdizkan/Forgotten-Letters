<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const b = $derived(data.board);
	const name = (id: string) => data.names[id] ?? id;
	const zone = (id: string) => data.zones[id] ?? id;
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const STEP: Record<string, string> = { rolling: 'Rolling for Aggressor', pairing: 'Aggressors pick opponents', battles: 'Battles', closed: 'Closed' };
	let opponent = $state('');
	const zonesFor = $derived(data.options?.opponents.find((o) => o.id === opponent)?.zones ?? []);
</script>

<svelte:head><title>Round · Admin</title></svelte:head>

<h1>{b ? `Round ${b.number}` : 'Rounds'}</h1>

{#if data.stage !== 'underway'}
	<p class="lede">Rounds begin once the campaign is under way (<a href="/admin/muster">Muster</a>).</p>
{:else if !b || b.step === 'closed'}
	<form method="POST" action="?/open" use:enhance={keep}>
		<p class="lede">{b ? `Round ${b.number} is closed.` : 'No round yet.'}</p>
		<button>Open {b ? `round ${b.number + 1}` : 'the first round'}</button>
	</form>
{/if}
{#if form?.message}<p class="note" role="status">{form.message}</p>{/if}

{#if b}
	<p class="step"><strong>{STEP[b.step]}</strong>{#if b.step === 'rolling' && b.reroll.length} · tie: {b.reroll.map(name).join(', ')} roll again{/if}</p>

	<div class="scroll">
		<table class="ledger">
			<thead><tr><th>#</th><th>Warband</th><th class="num">Its round</th><th class="num">Times Aggressor</th><th class="num">Rolls</th><th>Role</th><th></th></tr></thead>
			<tbody>
				{#each b.entries as e, i (e.warbandId)}
					<tr class:turn={b.picker === e.warbandId}>
						<td class="num">{i + 1}</td>
						<td>{name(e.warbandId)}</td>
						<td class="num">{e.playerRound}</td>
						<td class="num">{e.aggressions}</td>
						<td class="num">{e.rolls.join(' · ') || '—'}</td>
						<td>{e.role === 'aggressor' ? `Aggressor · picks ${e.pickOrder}` : e.role === 'defender' ? 'Non-Aggressor' : e.role === 'bye' ? 'Waits (no opponent)' : e.role === 'passed' ? 'Passed' : ''}</td>
						<td>
							{#if b.step === 'rolling' && (b.waiting.includes(e.warbandId) || b.reroll.includes(e.warbandId))}
								<form method="POST" action="?/roll" use:enhance={keep}><input type="hidden" name="warband" value={e.warbandId} /><button class="ghost small">Roll for them</button></form>
							{:else if b.picker === e.warbandId}
								<span class="turn-tag">Picking now</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if b.step === 'pairing' && data.options}
		<form method="POST" action="?/pick" class="pick rules-box" use:enhance={keep}>
			<h2>Pick for {name(data.options.picker)}</h2>
			<input type="hidden" name="aggressor" value={data.options.picker} />
			<label>Opponent
				<select name="defender" bind:value={opponent} required>
					<option value="">Choose…</option>
					{#each data.options.opponents as o (o.id)}<option value={o.id}>{name(o.id)}</option>{/each}
				</select>
			</label>
			<label>Battlefield
				<select name="zone" required disabled={!opponent}>
					<option value="">Choose…</option>
					{#each zonesFor as z (z)}<option value={z}>{zone(z)}</option>{/each}
				</select>
			</label>
			<label class="inline"><input type="checkbox" name="override" /> Allow a zone the rules don't (override)</label>
			<button>Plan the battle</button>
		</form>
	{/if}

	{#if data.challenges.length}
		<h2>Challenges waiting for an answer</h2>
		<ul class="battles">
			{#each data.challenges as x (x.id)}
				<li>
					<strong>{name(x.aggressor)}</strong> challenges <strong>{name(x.defender)}</strong> · {zone(x.zone)}
					<small>{x.roundId ? 'round pick' : 'arranged'}</small>
					<form method="POST" action="?/answer" use:enhance={keep} class="inline-f">
						<input type="hidden" name="challenge" value={x.id} />
						<button class="ghost small" name="accept" value="yes">Accept for them</button>
						<button class="ghost small" name="accept" value="no">Decline</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	{#if b.battles.length}
		<h2>Battles</h2>
		<ul class="battles">
			{#each b.battles as g (g.id)}
				<li>
					<strong>{name(g.aggressor)}</strong> <span class="vs">vs</span> <strong>{name(g.defender)}</strong> · {zone(g.zone)}
					<small>{g.status === 'scheduled' ? 'planned' : g.status === 'in_progress' ? 'being fought' : 'recorded'}</small>
					{#if g.status !== 'done'}<a href="/admin/games/{g.id}">Record →</a>{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<h2>Every warband's round</h2>
<p class="lede">
	A warband's round is its battles fought plus rounds passed, plus one. One that is behind can arrange a battle with anyone, or
	be passed here. Passing counts as a game played; unless excused it takes {data.penalty.length ? data.penalty.join(', ') : 'nothing (no penalty is set: Campaign → Round pass penalty)'}.
</p>
<div class="scroll">
	<table class="ledger">
		<thead><tr><th>Warband</th><th class="num">Round</th><th class="num">Games left</th><th>Now</th><th></th></tr></thead>
		<tbody>
			{#each data.standing as w (w.id)}
				<tr>
					<td>{name(w.id)}</td>
					<td class="num">{w.left > 0 ? w.round : '—'}</td>
					<td class="num">{w.left}</td>
					<td>{w.busy ? 'In a battle' : w.challenged ? 'In a challenge' : w.left > 0 ? 'Free' : 'Done'}</td>
					<td>
						{#if w.left > 0 && !w.busy && !w.challenged}
							<form method="POST" action="?/pass" class="inline-f" use:enhance={keep}>
								<input type="hidden" name="warband" value={w.id} />
								<input type="hidden" name="name" value={name(w.id)} />
								<input name="note" placeholder="Note (why)" aria-label="Note" class="note-in" />
								<label class="inline"><input type="checkbox" name="excused" /> Excused</label>
								<button class="ghost small danger">Pass round {w.round}</button>
							</form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.lede,
	.step {
		color: var(--ink-soft);
	}
	.note {
		font-weight: 600;
	}
	.scroll {
		overflow-x: auto;
	}
	.ledger {
		width: 100%;
		border-collapse: collapse;
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
	}
	.ledger th {
		text-align: left;
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
		padding: 6px 10px 4px 0;
		border-bottom: 1px solid var(--rule);
	}
	.ledger td {
		padding: 6px 10px 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	.num {
		text-align: right;
		font-variant-numeric: lining-nums tabular-nums;
	}
	tr.turn td {
		background: var(--parchment);
	}
	.turn-tag {
		color: var(--blood);
		font-weight: 700;
	}
	.pick {
		display: grid;
		gap: 10px;
		margin-top: 16px;
		max-width: 32rem;
	}
	.pick h2 {
		margin: 0;
	}
	.pick label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	.pick label.inline {
		display: flex;
		gap: 8px;
		font-weight: 400;
	}
	.inline-f {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.note-in {
		width: 10rem;
	}
	.battles {
		list-style: none;
		padding: 0;
		border-top: 2px solid var(--ink);
	}
	.battles li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: baseline;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	.vs {
		font-family: var(--font-display);
		color: var(--blood);
	}
	small {
		color: var(--muted);
	}
</style>
