<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { enhance } from '$app/forms';
	import Portrait from '$lib/components/Portrait.svelte';
	import ExplorationEditor from '$lib/components/ExplorationEditor.svelte';
	import { RESOURCES, RESOURCE_NAMES, type Exploration, type Resource, type SideResult } from '$lib/rules/types';
	import type { Prompt } from '$lib/rules/engine';
	import type { Snapshot } from '$lib/server/games';

	let { data, form } = $props();

	const zone = $derived(data.zone);
	const sidesInfo = $derived([
		{ ...data.aggressor, role: 'Aggressor' as const },
		{ ...data.defender, role: 'Defender' as const }
	]);

	const blankExploration = (table?: Resource): Exploration => ({ table, dice: [], total: 0, effects: [] });

	function initialSide(id: string, aggressor: boolean): SideResult {
		const s = data.saved.sides[id];
		return {
			deeds: s?.deeds ?? 0,
			fills: s?.fills ?? [],
			anyChoices: s?.anyChoices ?? [],
			exploration: s?.exploration ?? blankExploration(aggressor ? data.zone.resources[0] : undefined),
			bonusExplorations: s?.bonusExplorations ?? [],
			vp: s?.vp,
			fallen: s?.fallen
		};
	}

	// svelte-ignore state_referenced_locally
	let winner = $state<string>(data.saved.winner ?? '');
	// svelte-ignore state_referenced_locally
	let sides = $state<Record<string, SideResult>>({
		[data.aggressor.id]: initialSide(data.aggressor.id, true),
		[data.defender.id]: initialSide(data.defender.id, false)
	});
	let force = $state(false);

	const draft = $derived({ winner: winner || null, sides });
	const maxFills = (id: string) => (id === data.aggressor.id && winner === id ? 2 : 1);

	// Keep resource marks within the allowance when the winner changes.
	$effect(() => {
		for (const id of Object.keys(sides)) {
			const max = maxFills(id);
			if (sides[id].fills.length > max) sides[id].fills = sides[id].fills.slice(0, max);
		}
	});

	function toggleFill(id: string, r: Resource) {
		const s = sides[id];
		if (s.fills.includes(r)) s.fills = s.fills.filter((x) => x !== r);
		else if (maxFills(id) === 1) s.fills = [r];
		else if (s.fills.length < 2) s.fills = [...s.fills, r];
	}

	// Live preview from the server's rules engine.
	type Preview = {
		sides: { id: string; before: Snapshot; after: Snapshot; folly: boolean }[];
		pending: Prompt[];
		warnings: string[];
	};
	// svelte-ignore state_referenced_locally
	let preview = $state<Preview>(data.preview);
	$effect(() => {
		const body = JSON.stringify(draft);
		const t = setTimeout(async () => {
			const res = await fetch(`/admin/games/${data.game.id}/preview`, { method: 'POST', body });
			if (res.ok) preview = await res.json();
		}, 250);
		return () => clearTimeout(t);
	});

	const pendingFor = (id: string, kind: Prompt['kind']) => preview.pending.filter((p) => p.warband === id && p.kind === kind);

	function addBonus(id: string, table: Resource) {
		sides[id].bonusExplorations = [...(sides[id].bonusExplorations ?? []), blankExploration(table)];
	}

	function poolHint(id: string, table?: Resource) {
		const s = preview.sides.find((x) => x.id === id)?.before;
		if (!s) return 3;
		const building = table ? { F: s.buildings.shrine, R: s.buildings.vault, S: s.buildings.depot, T: s.buildings.garrison }[table] : 0;
		return s.dice + (building >= 2 ? 1 : 0);
	}

	// House rule Razing: offered when a winning Aggressor fights where the defender holds an Outpost.
	const canRaze = $derived(
		data.razing &&
			winner === data.aggressor.id &&
			!!preview.sides.find((x) => x.id === data.defender.id)?.before.outpostZones.includes(zone.id)
	);
	$effect(() => {
		if (!canRaze && sides[data.aggressor.id].raze) sides[data.aggressor.id].raze = false;
	});

	const delta = (a: number, b: number) => (b - a > 0 ? `+${b - a}` : b - a < 0 ? `${b - a}` : '');
</script>

<p><a href="/admin/games">← Games</a></p>

<header class="head">
	<h1>{zone.name}</h1>
	<p class="muted">
		<strong class="status">{data.game.status === 'done' ? 'Recorded' : 'In progress'}</strong> ·
		{data.game.scenario ?? 'Scenario not set'}
		{#if data.game.weather}· <strong>{data.game.weather.name}</strong>: {data.game.weather.effect}{/if}
	</p>
</header>

<section>
	<h2>The outcome</h2>
	<div class="outcome">
		{#each sidesInfo as s (s.id)}
			<label class="choice" class:chosen={winner === s.id}>
				<input type="radio" bind:group={winner} value={s.id} />
				<Portrait name={s.player} portrait={s.portrait} symbol={s.symbol} faction={s.faction} size={48} />
				<span><strong>{s.player}</strong> won<br /><small>{s.role}</small></span>
			</label>
		{/each}
		<label class="choice" class:chosen={winner === ''}>
			<input type="radio" bind:group={winner} value="" />
			<span><strong>Draw</strong><br /><small>no Conquest, no Outpost</small></span>
		</label>
	</div>
</section>

{#each sidesInfo as info (info.id)}
	{@const s = sides[info.id]}
	{@const pv = preview.sides.find((x) => x.id === info.id)}
	<section>
		<h2>{info.player} <small>{info.role} · {info.name}</small></h2>

		<div class="grid">
			<label>
				Glorious Deeds completed
				<input type="number" min="0" max="20" bind:value={s.deeds} class="short" />
			</label>
			<label>
				Victory Points
				<input type="number" min="0" max="99" bind:value={s.vp} class="short" placeholder="—" />
			</label>
			<label>
				Models Out of Action
				<input type="number" min="0" max="99" bind:value={s.fallen} class="short" placeholder="—" />
			</label>
			<fieldset>
				<legend>Resource box{maxFills(info.id) > 1 ? 'es (2, different)' : ''}</legend>
				{#each zone.resources as r (r)}
					<label class="check res res-{r}">
						<input type="checkbox" checked={s.fills.includes(r)} onchange={() => toggleFill(info.id, r)} />
						{RESOURCE_NAMES[r]}
					</label>
				{/each}
			</fieldset>
		</div>

		{#if info.role === 'Aggressor' && canRaze}
			<label class="check raze">
				<input type="checkbox" bind:checked={s.raze} />
				Raze {data.defender.player}'s Outpost here instead of rolling on an Exploration table (house rule)
			</label>
		{/if}

		<h3>Exploration</h3>
		{#if s.exploration}
			<ExplorationEditor
				bind:value={s.exploration}
				tables={info.role === 'Aggressor' ? zone.resources : []}
				defender={info.role === 'Defender'}
				dicePool={poolHint(info.id, s.exploration.table)}
				zones={data.zones}
			/>
		{/if}

		{#if (s.anyChoices?.length ?? 0) || pendingFor(info.id, 'fillAny').length}
			<h3>"+ any Resource" rewards</h3>
			<div class="choices">
				{#each s.anyChoices ?? [] as _, i (i)}
					<span class="pick">
						<select bind:value={s.anyChoices![i]}>
							{#each RESOURCES as r (r)}<option value={r}>{RESOURCE_NAMES[r]}</option>{/each}
						</select>
						<button type="button" class="x" aria-label="Remove" onclick={() => s.anyChoices!.splice(i, 1)}><Mark name="close" /></button>
					</span>
				{/each}
				{#each pendingFor(info.id, 'fillAny') as _, i (i)}
					<select class="needed" value="" onchange={(e) => { s.anyChoices = [...(s.anyChoices ?? []), e.currentTarget.value as Resource]; e.currentTarget.value = ''; }}>
						<option value="" disabled>Choose a track…</option>
						{#each RESOURCES as r (r)}<option value={r}>{RESOURCE_NAMES[r]}</option>{/each}
					</select>
				{/each}
			</div>
		{/if}

		{#each s.bonusExplorations ?? [] as _, i (i)}
			<h3>Tracker reward roll · {RESOURCE_NAMES[s.bonusExplorations![i].table ?? 'F']} table
				<button type="button" class="x" aria-label="Remove" onclick={() => s.bonusExplorations!.splice(i, 1)}><Mark name="close" /></button>
			</h3>
			<ExplorationEditor
				bind:value={s.bonusExplorations![i]}
				tables={[s.bonusExplorations![i].table ?? 'F']}
				dicePool={poolHint(info.id, s.bonusExplorations![i].table)}
				zones={data.zones}
			/>
		{/each}
		{#each pendingFor(info.id, 'explore') as p, i (i)}
			<p class="owed">
				A Tracker reward owes a roll on the {RESOURCE_NAMES[p.table!]} table.
				<button type="button" class="ghost" onclick={() => addBonus(info.id, p.table!)}>Record it</button>
			</p>
		{/each}

		{#if pv}
			<table class="delta">
				<tbody>
					<tr><th>CVP</th><td>{pv.after.cvp} <em>{delta(pv.before.cvp, pv.after.cvp)}</em></td>
						<th>Dice</th><td>{pv.after.dice}D6 <em>{delta(pv.before.dice, pv.after.dice)}</em></td>
						<th>Ducats</th><td>{pv.after.ducats} <em>{delta(pv.before.ducats, pv.after.ducats)}</em></td></tr>
					<tr>
						{#each RESOURCES as r (r)}
							<th class="res-{r}">{r}</th><td>{pv.after.tracks[r]}/15 <em>{delta(pv.before.tracks[r], pv.after.tracks[r])}</em></td>
						{/each}
					</tr>
					<tr><th>Outposts</th><td>{pv.after.outposts} ({pv.after.supplied} supplied)</td>
						<th>Omens</th><td>{pv.after.omens} <em>{delta(pv.before.omens, pv.after.omens)}</em></td>
						<th>Glory</th><td>{pv.after.gloryPoints} <em>{delta(pv.before.gloryPoints, pv.after.gloryPoints)}</em></td></tr>
				</tbody>
			</table>
			{#if pv.folly}<p class="owed">Rudolf's Folly makes an offer.</p>{/if}
		{/if}
	</section>
{/each}

{#if preview.warnings.length}
	<ul class="warnings">{#each preview.warnings as w, i (i)}<li>{w}</li>{/each}</ul>
{/if}

<form method="POST" action="?/commit" use:enhance class="commit">
	<input type="hidden" name="draft" value={JSON.stringify(draft)} />
	{#if preview.pending.length}
		<label class="check">
			<input type="checkbox" name="force" bind:checked={force} />
			Commit with {preview.pending.length} unresolved choice(s)
		</label>
	{/if}
	<button disabled={preview.pending.length > 0 && !force}>
		{data.game.status === 'done' ? 'Save changes' : 'Record the result'}
	</button>
	{#if form?.message}<span class="error">{form.message}</span>{/if}
</form>

<div class="danger">
	{#if data.game.status === 'done'}
		<form method="POST" action="?/reopen" use:enhance><button class="ghost">Reopen (hide from standings)</button></form>
	{/if}
	<form method="POST" action="?/delete" use:enhance>
		<button class="ghost">{data.game.status === 'done' ? 'Delete game' : 'Cancel game'}</button>
	</form>
</div>

<style>
	.head h1 {
		margin: 0;
	}
	.status {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.85rem;
		color: var(--blood);
	}
	section {
		margin: 16px 0;
		padding: 14px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	h2 {
		margin: 0 0 10px;
		font-size: 1.6rem;
	}
	h2 small {
		font-family: var(--font-body);
		font-size: 0.55em;
		color: var(--muted);
	}
	h3 {
		margin: 16px 0 6px;
		font-variant-caps: small-caps;
		color: var(--blood);
		font-size: 1.05rem;
	}
	.outcome {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
	}
	.choice.chosen {
		border-color: var(--blood);
		box-shadow: inset 0 0 0 1px var(--blood);
	}
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: start;
	}
	label {
		display: grid;
		gap: 4px;
	}
	.check {
		display: flex;
		gap: 6px;
		align-items: baseline;
	}
	fieldset {
		display: flex;
		gap: 14px;
		border: 1px solid var(--rule);
		padding: 6px 12px;
	}
	legend {
		color: var(--muted);
	}
	.res-F {
		color: var(--favour);
	}
	.res-R {
		color: var(--relics);
	}
	.res-S {
		color: var(--supplies);
	}
	.res-T {
		color: var(--territories);
	}
	.short {
		width: 5em;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.needed {
		border-color: var(--blood);
		box-shadow: 0 0 0 1px var(--blood);
	}
	.raze {
		margin-top: 10px;
		color: var(--blood);
	}
	.owed {
		color: var(--blood);
		font-weight: 600;
	}
	.delta {
		margin-top: 14px;
		border-collapse: collapse;
		font-size: 0.95em;
	}
	.delta th {
		text-align: left;
		font-weight: 600;
		padding: 2px 6px 2px 14px;
		font-variant-caps: small-caps;
	}
	.delta td {
		padding: 2px 6px;
	}
	.delta em {
		color: var(--supplies);
		font-style: normal;
		font-weight: 600;
	}
	.x,
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
		padding: 2px 10px;
	}
	.warnings {
		color: var(--blood);
	}
	.commit {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}
	.danger {
		display: flex;
		gap: 10px;
		margin-top: 24px;
	}
	.muted,
	small {
		color: var(--muted);
	}
	.error {
		color: var(--blood);
	}
</style>
