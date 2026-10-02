<script lang="ts">
	import { enhance } from '$app/forms';
	import UnitCard from '$lib/components/UnitCard.svelte';
	import type { RosterUnit } from '$lib/roster';

	let { data, form } = $props();
</script>

<p><a href="/admin/games">← Games</a></p>
<h1>Aftermath at {data.game.zone}</h1>
<p class="muted">
	Trauma, Promotions &amp; Experience from the Rulebook: roll the dice at the table and record what happened to each model.
	This updates the rosters only; the Campaign Tracker was settled when the result was recorded.
</p>
{#if form && 'updated' in form}<p class="ok">Recorded for {form.updated}.</p>{/if}
{#if form && 'message' in form}<p class="error">{form.message}</p>{/if}

<div class="sides">
	{#each data.sides as side (side.id)}
		<section>
			<h2>{side.player} <small>{side.name}{data.game.winner === side.id ? ' · victorious' : ''}</small></h2>
			{#if side.report}
				{@const l = side.report.lines}
				<div class="report">
					<h3>The player's report · {side.report.status}</h3>
					{#each l.models.filter((m) => m.trauma || m.promotion?.promoted || m.xp || m.advancements.length) as m (m.unitId)}
						<p>
							<b>{m.name || m.type}</b>
							{#if m.trauma}· {m.trauma.result} ({m.trauma.dice.join('·')}){/if}
							{#if m.promotion?.promoted}· promoted ({m.promotion.dice.join('·')}){/if}
							{#if m.xp}· +{m.xp} XP{/if}
							{#each m.advancements as a, k (k)}· learns {a.chosen ?? '?'} ({a.rolls.map((x) => `${x.table} ${x.total}`).join(', ')}){/each}
						</p>
					{/each}
					<p>Promotion dice: {l.promotion.pool} · Income: {l.income.ducats} D, {l.income.glory} G</p>
					{#if l.notes}<p class="muted">{l.notes}</p>{/if}
					{#if side.report.status === 'submitted'}
						<form method="POST" action="?/report" use:enhance>
							<input type="hidden" name="warband" value={side.id} />
							<button name="op" value="approve">Approve onto the roster</button>
							<input name="reply" placeholder="Why it goes back" />
							<button name="op" value="decline">Send back</button>
						</form>
					{/if}
				</div>
			{/if}
			{#each side.units as u (u.id)}
				<UnitCard unit={u as RosterUnit} photo={u.photo} compact>
					{#snippet actions()}
						<form method="POST" action="?/update" use:enhance={() => ({ update }) => update({ reset: true })}>
							<input type="hidden" name="warband" value={side.id} />
							<input type="hidden" name="unit" value={u.id} />
							<label>+XP <input name="xp" type="number" min="0" max="20" value="0" /></label>
							<input name="injury" placeholder="Injury / scar" />
							<input name="skill" placeholder="New skill" />
							{#if u.category !== 'elite'}<label class="check"><input type="checkbox" name="promote" /> Promote to Elite</label>{/if}
							<label class="check dead"><input type="checkbox" name="dead" /> Dead</label>
							<button>Record</button>
						</form>
					{/snippet}
				</UnitCard>
			{:else}
				<p class="muted"><em>No roster for this warband. Muster it in the roster builder.</em></p>
			{/each}
		</section>
	{/each}
</div>

<p><a class="button" href="/admin/games">Done</a></p>

<style>
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
		gap: 16px;
	}
	section {
		display: grid;
		gap: 6px;
		align-content: start;
	}
	h2 small {
		font-family: var(--font-body);
		font-size: 0.55em;
		color: var(--muted);
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	form input:not([type]) {
		width: 9rem;
	}
	form input[type='number'] {
		width: 4em;
	}
	label {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.dead {
		color: var(--blood);
	}
	.button {
		display: inline-block;
		margin-top: 16px;
		padding: 8px 14px;
		background: var(--ink);
		color: var(--parchment);
		text-decoration: none;
		font-variant-caps: small-caps;
	}
	.muted {
		color: var(--muted);
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
</style>
