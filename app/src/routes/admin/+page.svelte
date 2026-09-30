<script lang="ts">
	import { enhance } from '$app/forms';

	import { EXTENDED_MAX_PLAYERS, OFFICIAL_MAX_PLAYERS } from '$lib/seating';

	let { data, form } = $props();
	const c = $derived(data.campaign);
	// svelte-ignore state_referenced_locally
	let players = $state(data.campaign?.expectedPlayers ?? 8);
	// svelte-ignore state_referenced_locally
	let houseZones = $state(data.campaign?.houseZones ?? false);
	// A new campaign picks the extension automatically once it needs more than the official 12.
	$effect(() => {
		if (!c) houseZones = players > OFFICIAL_MAX_PLAYERS;
	});
	const packs = $derived(Math.ceil(players / 8));
</script>

<h1>{c ? c.name : 'Found a Campaign'}</h1>

{#if data.setup}
	<section class="setup" aria-label="Setting up">
		<h2>Setting up</h2>
		<ol>
			{#each data.setup as s (s.href)}
				<li class:done={s.done}><a href={s.href}>{s.label}</a>{#if s.done} <span>done</span>{/if}</li>
			{/each}
		</ol>
	</section>
{/if}

<form method="POST" action={c ? '?/update' : '?/create'} use:enhance={() => ({ update }) => update({ reset: false })}>
	<fieldset>
		<legend>The campaign</legend>
		<label>Name <input name="name" value={c?.name ?? 'Carcass Front'} required /></label>
		<label>
			Players
			<input name="expectedPlayers" type="number" min="2" max={EXTENDED_MAX_PLAYERS} bind:value={players} />
			<small>
				The official map suits up to {OFFICIAL_MAX_PLAYERS}; our house zones extend it to {EXTENDED_MAX_PLAYERS}.
				Needs {packs} pack{packs > 1 ? 's' : ''} of Vision cards.
			</small>
		</label>
		<label>
			Games per player
			<input name="gamesPerPlayer" type="number" min="1" max="12" value={c?.gamesPerPlayer ?? 8} />
		</label>
		<label>
			Random scenario length (turns)
			<input name="randomScenarioTurns" type="number" min="1" max="10" value={c?.randomScenarioTurns ?? 4} />
			<small>The Player's Guide says 4; the map's generator says 6.</small>
		</label>
		<label>
			Glory track scoring
			<select name="gloryScoring" value={c?.gloryScoring ?? 'boxIndex'}>
				<option value="boxIndex">Box n scores n CVP (as printed)</option>
				<option value="deeds">Deeds written score as CVP</option>
				<option value="none">No CVP from Glory</option>
			</select>
		</label>
	</fieldset>

	<fieldset>
		<legend>Our campaign &amp; house rules</legend>
		<label class="check">
			<input type="checkbox" name="houseZones" bind:checked={houseZones} />
			House zones: Entry Zones E &amp; F and zones 1–6
		</label>
		{#if players > OFFICIAL_MAX_PLAYERS && !houseZones}
			<p class="warn">{players} players is more than the official map's {OFFICIAL_MAX_PLAYERS} — the house zones are recommended.</p>
		{:else if players <= OFFICIAL_MAX_PLAYERS && houseZones}
			<p class="muted">Optional with {players} players: the official map already has room.</p>
		{/if}
		<label class="check">
			<input type="checkbox" name="houseRazing" checked={c?.houseRazing ?? false} />
			Razing: a winning Aggressor may strike out an opponent's Outpost
		</label>
		<label class="check">
			<input type="checkbox" name="houseOutpostLevy" checked={c?.houseOutpostLevy ?? false} />
			Outpost Levy: 5 Ducats per supplied Outpost each Exploration Step
		</label>
	</fieldset>

	<fieldset>
		<legend>Round pass penalty</legend>
		<p class="muted">
			Taken from a warband the Campaign Master passes for a round it failed to plan without telling anyone (Admin → Round). The
			pass counts as a game played. A warband that warned it would be late can be passed as excused, without this.
		</p>
		<div class="penalty">
			<label>CVP <input name="penCvp" type="number" min="0" max="50" value={c?.passPenalty.cvp ?? 0} /></label>
			<label>Glory <input name="penGlory" type="number" min="0" max="50" value={c?.passPenalty.glory ?? 0} /></label>
			<label>Ducats <input name="penDucats" type="number" min="0" max="1000" step="5" value={c?.passPenalty.ducats ?? 0} /></label>
			<label>Favour boxes <input name="penF" type="number" min="0" max="15" value={c?.passPenalty.boxes?.F ?? 0} /></label>
			<label>Relics boxes <input name="penR" type="number" min="0" max="15" value={c?.passPenalty.boxes?.R ?? 0} /></label>
			<label>Supplies boxes <input name="penS" type="number" min="0" max="15" value={c?.passPenalty.boxes?.S ?? 0} /></label>
			<label>Territories boxes <input name="penT" type="number" min="0" max="15" value={c?.passPenalty.boxes?.T ?? 0} /></label>
		</div>
	</fieldset>

	{#if c}
		<fieldset class="danger">
			<legend>Endgame</legend>
			<label class="check">
				<input type="checkbox" name="visionsRevealed" checked={c.visionsRevealed} />
				Reveal Vision cards to everyone
			</label>
		</fieldset>
	{/if}

	{#if c && data.reckoning?.length}
		<details class="reckoning">
			<summary>Preview the final reckoning (Campaign Master only)</summary>
			<table>
				<thead>
					<tr><th></th><th>Player</th><th>Tracker</th><th>Herald</th><th>Enclave</th><th>Vision</th><th>Total</th></tr>
				</thead>
				<tbody>
					{#each data.reckoning as r, i (r.id)}
						<tr>
							<td>{i + 1}</td>
							<td>{r.player} <small>{r.warband}</small></td>
							<td>{r.trackerCvp}</td>
							<td>{r.herald || ''}</td>
							<td>{r.enclave || ''}</td>
							<td>{r.vision ? `${r.vision} ${r.visionLevel}/3 · ${r.visionCvp}` : '—'}</td>
							<td><strong>{r.total}</strong></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<small>Ticking "Reveal Vision cards" publishes this to every player.</small>
		</details>
	{/if}

	<button>{c ? 'Save' : 'Begin the campaign'}</button>
	{#if form?.saved}<span class="ok">Recorded.</span>{/if}
	{#if form?.message}<span class="error">{form.message}</span>{/if}
</form>

<style>
	.penalty {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 8px 12px;
	}
	.penalty label {
		display: grid;
		gap: 2px;
	}
	form {
		display: grid;
		gap: 18px;
		max-width: 40rem;
	}
	/* Settings groups read as the book's rules boxes. */
	fieldset {
		display: grid;
		gap: 12px;
		border: 1px solid var(--blood);
		background: var(--parchment);
		padding: 14px 18px;
	}
	legend {
		padding: 0 6px;
		font-weight: 700;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink);
		background: var(--paper);
	}
	label {
		display: grid;
		gap: 4px;
	}
	label.check {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	small {
		color: var(--muted);
	}
	.danger {
		border-color: var(--blood);
	}
	.reckoning {
		border: 1px solid var(--rule);
		background: var(--parchment);
		padding: 10px 14px;
	}
	.reckoning summary {
		cursor: pointer;
		font-variant-caps: small-caps;
		color: var(--blood);
		font-weight: 600;
	}
	.reckoning table {
		width: 100%;
		border-collapse: collapse;
		margin: 8px 0;
	}
	.reckoning th,
	.reckoning td {
		text-align: left;
		padding: 3px 6px;
		border-bottom: 1px solid var(--rule);
	}
	.warn {
		margin: 0;
		color: var(--blood);
	}
	.muted {
		margin: 0;
		color: var(--muted);
	}
	.ok {
		color: var(--supplies);
		margin-left: 10px;
	}
	.error {
		color: var(--blood);
		margin-left: 10px;
	}
	.setup {
		margin: 12px 0 24px;
		padding: 10px 16px;
		border-left: 3px solid var(--blood);
		background: rgba(139, 42, 29, 0.05);
	}
	.setup h2 {
		margin: 0 0 6px;
	}
	.setup ol {
		margin: 0;
		padding-left: 1.4em;
		display: grid;
		gap: 4px;
	}
	.setup li.done a {
		color: var(--muted);
		text-decoration: line-through;
	}
	.setup li span {
		color: var(--supplies);
		font-size: 0.85rem;
	}
</style>
