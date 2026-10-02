<script lang="ts">
	/**
	 * The Campaign Phase after a battle, for the warband's player: mark who went Out of Action and the Glorious
	 * Deeds, then the server rolls Trauma, Promotions and Advancements (each once), and the report goes to the
	 * Campaign Master to approve.
	 */
	import { enhance } from '$app/forms';
	import type { AftermathLines } from '$lib/aftermath';

	type Battle = { gameId: string; zone: string; won: boolean; at: string | null; report: { id: string; status: string; reply: string | null; lines: AftermathLines } | null };
	let {
		battles,
		skillTables,
		tablesToPick = 2,
		message = null
	}: { battles: Battle[]; skillTables: { id: string; name: string }[]; tablesToPick?: number; message?: string | null } = $props();

	const keep = () => async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const STATUS: Record<string, string> = { draft: 'In progress', submitted: 'With the Campaign Master', approved: 'Approved', declined: 'Sent back' };
	const open = $derived(battles.find((b) => b.report?.status !== 'approved') ?? null);
	const dice = (xs: number[]) => xs.join(' · ');
</script>

<details class="panel rulespanel" open={!!open && open.report?.status !== 'submitted'}>
	<summary><h2>Aftermath{open ? ` · ${STATUS[open.report?.status ?? 'draft']}` : ''}</h2></summary>
	{#if !battles.length}
		<p class="dim">After your first battle you record its aftermath here: Trauma, Promotions and Experience.</p>
	{/if}
	{#each battles as b (b.gameId)}
		{@const r = b.report}
		{@const editable = !r || r.status === 'draft' || r.status === 'declined'}
		<details class="battle" open={b === open}>
			<summary>
				<b>{b.won ? 'Won' : 'Fought'} at {b.zone}</b>
				<span class="dim">{b.at ? new Date(b.at).toLocaleDateString() : ''} · {STATUS[r?.status ?? 'draft']}</span>
			</summary>
			{#if r?.reply}<p class="error">The Campaign Master: {r.reply}</p>{/if}
			{#if !r}
				<form method="POST" action="?/aftermath" use:enhance={keep}>
					<input type="hidden" name="game" value={b.gameId} />
					<button class="action small" name="op" value="mark">Record the aftermath</button>
				</form>
			{:else}
				<form method="POST" action="?/aftermath" use:enhance={keep} class="marks">
					<input type="hidden" name="game" value={b.gameId} />
					<input type="hidden" name="op" value="mark" />
					<table>
						<thead><tr><th>Model</th><th>Out of Action</th><th>Glorious Deeds</th><th>Experience</th></tr></thead>
						<tbody>
							{#each r.lines.models as m (m.unitId)}
								<tr>
									<td>{m.name || m.type}{m.elite ? ' ★' : ''}</td>
									<td><input type="checkbox" name="ooa-{m.unitId}" checked={m.outOfAction} disabled={!editable || !!m.trauma} aria-label="{m.name || m.type} taken Out of Action" /></td>
									<td><input type="number" name="deeds-{m.unitId}" min="0" max="9" value={m.deeds} disabled={!editable || r.lines.promotion.rolled} aria-label="Glorious Deeds of {m.name || m.type}" /></td>
									<td>{m.xp ? `+${m.xp}` : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<div class="row">
						<label>Ducats earned <input type="number" name="ducats" value={r.lines.income.ducats} disabled={!editable} /></label>
						<label>Glory earned <input type="number" name="glory" value={r.lines.income.glory} disabled={!editable} /></label>
					</div>
					<label class="wide">Notes (exploration, loot) <textarea name="notes" rows="2" disabled={!editable}>{r.lines.notes}</textarea></label>
					{#if editable}<button class="action small">Save</button>{/if}
				</form>

				<h4>Trauma</h4>
				{#each r.lines.models.filter((m) => m.outOfAction) as m (m.unitId)}
					<div class="roll">
						<span>{m.name || m.type}</span>
						{#if m.trauma}
							<span><b>{m.trauma.result}</b> <small class="dim">({dice(m.trauma.dice)})</small> {m.trauma.text}</span>
						{:else if editable}
							<form method="POST" action="?/aftermath" use:enhance={keep} class="inline">
								<input type="hidden" name="game" value={b.gameId} />
								<input type="hidden" name="unit" value={m.unitId} />
								<button class="mini" name="op" value="trauma">Roll {m.elite ? 'Trauma (D66)' : 'Survival (D6)'}</button>
							</form>
						{/if}
					</div>
				{:else}<p class="dim">Nobody was taken Out of Action.</p>{/each}

				<h4>Promotions</h4>
				{#if r.lines.promotion.rolled}
					<p class="dim">{r.lines.promotion.pool} Promotion {r.lines.promotion.pool === 1 ? 'die' : 'dice'}</p>
					{#each r.lines.models.filter((m) => m.promotion) as m (m.unitId)}
						<p class="roll"><span>{m.name || m.type}</span><span>{dice(m.promotion!.dice)} {m.promotion!.promoted ? '— promoted to ELITE' : ''}</span></p>
					{/each}
				{:else if editable}
					<form method="POST" action="?/aftermath" use:enhance={keep}>
						<input type="hidden" name="game" value={b.gameId} />
						<button class="mini" name="op" value="promote">Roll Promotions</button>
					</form>
				{/if}

				{#if r.lines.promotion.rolled}
					<h4>Advancements</h4>
					{#each r.lines.models.filter((m) => m.elite) as m (m.unitId)}
						{#each m.advancements as a, k (k)}
							<div class="roll">
								<span>{m.name || m.type}</span>
								{#if a.chosen}
									<span>learns <b>{a.chosen}</b></span>
								{:else}
									<form method="POST" action="?/aftermath" use:enhance={keep} class="inline">
										<input type="hidden" name="game" value={b.gameId} />
										<input type="hidden" name="unit" value={m.unitId} />
										<input type="hidden" name="index" value={k} />
										<input type="hidden" name="op" value="choose" />
										{#each a.rolls.flatMap((x) => (x.skill ?? '').split(' or ').filter(Boolean).map((s) => ({ s, x }))) as { s, x } (s)}
											<button class="mini" name="skill" value={s} title={x.text}>{s} <small>({dice(x.dice)})</small></button>
										{/each}
									</form>
								{/if}
							</div>
						{/each}
						{#if editable}
							<form method="POST" action="?/aftermath" use:enhance={keep} class="inline advance">
								<input type="hidden" name="game" value={b.gameId} />
								<input type="hidden" name="unit" value={m.unitId} />
								<span>{m.name || m.type}:</span>
								{#each skillTables as t (t.id)}<label><input type="checkbox" name="tables" value={t.id} /> {t.name}</label>{/each}
								<button class="mini" name="op" value="advance" title="Pick {tablesToPick} tables; for a model with an Advancement Roll due">Advancement Roll</button>
							</form>
						{/if}
					{/each}
				{/if}

				{#if editable}
					<form method="POST" action="?/aftermath" use:enhance={keep} class="submit">
						<input type="hidden" name="game" value={b.gameId} />
						<button class="action small" name="op" value="submit">Send to the Campaign Master</button>
					</form>
				{:else if r.status === 'submitted'}
					<form method="POST" action="?/aftermath" use:enhance={keep}>
						<input type="hidden" name="game" value={b.gameId} />
						<button class="mini" name="op" value="withdraw">Take it back to change it</button>
					</form>
				{/if}
			{/if}
		</details>
	{/each}
	{#if message}<p class="error" role="alert">{message}</p>{/if}
</details>

<style>
	.battle {
		margin: 8px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 6px;
	}
	.battle > summary {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		cursor: pointer;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 3px 4px;
	}
	td input[type='number'] {
		width: 4rem;
	}
	.row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin: 8px 0;
	}
	.row label,
	.wide {
		display: grid;
		gap: 3px;
	}
	.roll {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: baseline;
		margin: 4px 0;
	}
	.roll > span:first-child {
		min-width: 8rem;
		font-weight: 600;
	}
	.inline {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.advance label {
		font-size: 0.85rem;
	}
	h4 {
		margin: 12px 0 4px;
	}
	.submit {
		margin-top: 12px;
	}
</style>
