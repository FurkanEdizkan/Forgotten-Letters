<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Portrait from '$lib/components/Portrait.svelte';
	import UnitCard from '$lib/components/UnitCard.svelte';
	import { rosterTotals, rosterWarnings, sellValue, type Item, type RosterUnit } from '$lib/roster';
	import { FACTIONS } from '$lib/rules/factions';

	let { data, form } = $props();

	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const selectedId = $derived(page.url.searchParams.get('unit'));
	const selected = $derived(data.units.find((u) => u.id === selectedId) ?? null);
	const groups = $derived([
		{ title: 'Elites', units: data.units.filter((u) => u.status === 'active' && u.category === 'elite') },
		{ title: 'Troops', units: data.units.filter((u) => u.status === 'active' && u.category === 'troop') },
		{ title: 'Mercenaries', units: data.units.filter((u) => u.status === 'active' && u.category === 'mercenary') },
		{ title: 'Fallen & retired', units: data.units.filter((u) => u.status !== 'active') }
	]);
	const stashItems = $derived(data.stash.map((s) => ({ name: s.name, kind: s.kind, cost: s.cost, currency: s.currency }) as Item));
	const totals = $derived(rosterTotals(data.units as RosterUnit[], stashItems));
	const warnings = $derived(rosterWarnings(data.units as RosterUnit[]));
	const select = (id: string | null) => goto(id ? `?unit=${id}` : '?', { keepFocus: true, noScroll: true, replaceState: true });

	// Detail editor: a local copy of the selected model.
	const lines = (xs: string[]) => xs.join('\n');
	const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
	let draft = $state<RosterUnit | null>(null);
	let upgradesText = $state('');
	let skillsText = $state('');
	let injuriesText = $state('');
	$effect(() => {
		draft = selected ? structuredClone({ ...selected, stats: { ...selected.stats } }) : null;
		upgradesText = selected ? lines(selected.upgrades) : '';
		skillsText = selected ? lines(selected.skills) : '';
		injuriesText = selected ? lines(selected.injuries) : '';
	});
	const draftJson = $derived(
		draft ? JSON.stringify({ ...draft, upgrades: split(upgradesText), skills: split(skillsText), injuries: split(injuriesText) }) : ''
	);

	// New model and new item forms
	let newUnit = $state<RosterUnit>({
		name: '', type: '', category: 'troop', leader: false, cost: 0, currency: 'ducats', experience: 0,
		equipment: [], upgrades: [], skills: [], injuries: [], stats: {}, notes: null, status: 'active'
	});
	let newItem = $state<Item>({ name: '', kind: 'melee', cost: 0, currency: 'ducats' });
	const moveTargets = $derived([{ id: 'stash', name: 'Stash' }, ...data.units.filter((u) => u.status === 'active').map((u) => ({ id: u.id, name: u.name }))]);
</script>

<p><a href="/admin/warbands/{data.warband.id}">← {data.warband.name}</a></p>

<header class="top">
	<Portrait name={data.player.name} portrait={data.player.portrait} symbol={data.warband.symbol} size={56} />
	<div>
		<h1>{data.warband.name}</h1>
		<div class="muted">{data.player.name} · {data.warband.variant ?? FACTIONS.find((f) => f.id === data.warband.faction)?.name ?? data.warband.faction}</div>
	</div>
	<form class="bank" method="POST" action="?/bank" use:enhance={keep}>
		<label>Ducats <input name="ducats" type="number" value={data.warband.ducats} /></label>
		<label>Glory <input name="glory" type="number" value={data.warband.glory} /></label>
		<input type="hidden" name="notes" value={data.warband.notes ?? ''} />
		<button>Save bank</button>
	</form>
</header>

<div class="summary">
	<span>Roster value <strong>{totals.ducats}</strong> Ducats · <strong>{totals.glory}</strong> Glory</span>
	<span>Bank <strong>{data.warband.ducats}</strong> Ducats · <strong>{data.warband.glory}</strong> Glory</span>
	<span>{data.units.filter((u) => u.status === 'active').length} models</span>
	{#each warnings as w (w)}<span class="warn">⚠ {w}</span>{/each}
</div>

<div class="layout">
	<section class="list">
		{#each groups as g (g.title)}
			{#if g.units.length}
				<h2>{g.title}</h2>
				{#each g.units as u (u.id)}
					<UnitCard unit={u as RosterUnit} photo={u.photo} selected={u.id === selectedId} onclick={() => select(u.id)} />
				{/each}
			{/if}
		{/each}
		{#if !data.units.length}<p class="muted"><em>No models yet. Muster one below, or import a list.</em></p>{/if}

		<details class="add" open={!data.units.length}>
			<summary>+ Muster a model</summary>
			<form method="POST" action="?/addUnit" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') newUnit.name = ''; }}>
				<div class="grid">
					<label>Name <input bind:value={newUnit.name} required /></label>
					<label>Type <input bind:value={newUnit.type} placeholder="e.g. Trench Pilgrim" /></label>
					<label>Category
						<select bind:value={newUnit.category}>
							<option value="elite">Elite</option><option value="troop">Troop</option><option value="mercenary">Mercenary</option>
						</select>
					</label>
					<label>Cost <input type="number" min="0" bind:value={newUnit.cost} /></label>
					<label>In
						<select bind:value={newUnit.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select>
					</label>
				</div>
				<label class="check"><input type="checkbox" bind:checked={newUnit.leader} /> Leader</label>
				<label class="check"><input type="checkbox" name="pay" checked /> Pay from the bank</label>
				<input type="hidden" name="unit" value={JSON.stringify(newUnit)} />
				<button disabled={!newUnit.name}>Add model</button>
			</form>
		</details>

		<h2>Stash</h2>
		{#each data.stash as s (s.id)}
			<div class="item">
				<span>{s.name} <small>{s.cost} {s.currency === 'glory' ? 'Glory' : 'D'}</small></span>
				<form method="POST" action="?/itemOp" use:enhance={keep}>
					<input type="hidden" name="stashId" value={s.id} />
					<select name="target">{#each moveTargets.filter((t) => t.id !== 'stash') as t (t.id)}<option value={t.id}>{t.name}</option>{/each}</select>
					<button name="op" value="move" class="ghost" disabled={moveTargets.length < 2}>Give</button>
					<button name="op" value="sell" class="ghost" title="Sell for {sellValue(s.cost)}">Sell</button>
					<button name="op" value="refund" class="ghost">Refund</button>
					<button name="op" value="delete" class="ghost">Delete</button>
				</form>
			</div>
		{:else}
			<p class="muted"><em>The paychest is empty.</em></p>
		{/each}
	</section>

	<section class="detail">
		{#if draft && selected}
			<div class="detail-head">
				<h2>{selected.name}</h2>
				<button type="button" class="ghost" onclick={() => select(null)}>Close</button>
			</div>
			<form method="POST" action="?/saveUnit" enctype="multipart/form-data" use:enhance={keep}>
				<input type="hidden" name="unitId" value={selected.id} />
				<input type="hidden" name="unit" value={draftJson} />
				<div class="grid">
					<label>Name <input bind:value={draft.name} /></label>
					<label>Type <input bind:value={draft.type} /></label>
					<label>Category
						<select bind:value={draft.category}>
							<option value="elite">Elite</option><option value="troop">Troop</option><option value="mercenary">Mercenary</option>
						</select>
					</label>
					<label>Status
						<select bind:value={draft.status}>
							<option value="active">Active</option><option value="dead">Dead</option><option value="retired">Retired</option>
						</select>
					</label>
					<label>Cost <input type="number" min="0" bind:value={draft.cost} /></label>
					<label>In <select bind:value={draft.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
					<label>Experience <input type="number" min="0" bind:value={draft.experience} /></label>
					<label class="check"><input type="checkbox" bind:checked={draft.leader} /> Leader</label>
				</div>
				<fieldset>
					<legend>Profile</legend>
					<div class="stats-edit">
						{#each [['movement', 'Movement'], ['ranged', 'Ranged'], ['melee', 'Melee'], ['armour', 'Armour'], ['base', 'Base']] as [k, l] (k)}
							<label>{l} <input bind:value={draft.stats[k as keyof RosterUnit['stats']]} placeholder="—" /></label>
						{/each}
					</div>
				</fieldset>
				<div class="grid three">
					<label>Upgrades <textarea rows="3" bind:value={upgradesText} placeholder="one per line"></textarea></label>
					<label>Skills <textarea rows="3" bind:value={skillsText} placeholder="one per line"></textarea></label>
					<label>Injuries &amp; scars <textarea rows="3" bind:value={injuriesText} placeholder="one per line"></textarea></label>
				</div>
				<label>Notes <textarea rows="2" bind:value={draft.notes}></textarea></label>
				<div class="row">
					<label>Photo of the miniature <input type="file" name="photo" accept="image/*" /></label>
					{#if selected.photo}<label class="check"><input type="checkbox" name="clearPhoto" /> Remove photo</label>{/if}
				</div>
				<button>Save model</button>
				{#if form && 'message' in form}<span class="error">{form.message}</span>{/if}
			</form>

			<h3>Equipment</h3>
			{#each selected.equipment as e, i (i)}
				<div class="item">
					<span>{e.name} <small>{e.kind} · {e.cost} {e.currency === 'glory' ? 'Glory' : 'D'}</small></span>
					<form method="POST" action="?/itemOp" use:enhance={keep}>
						<input type="hidden" name="unitId" value={selected.id} />
						<input type="hidden" name="index" value={i} />
						<select name="target">{#each moveTargets.filter((t) => t.id !== selected.id) as t (t.id)}<option value={t.id}>{t.name}</option>{/each}</select>
						<button name="op" value="move" class="ghost">Move</button>
						<button name="op" value="copy" class="ghost" title="Buy another">Buy again</button>
						<button name="op" value="sell" class="ghost" title="Sell for {sellValue(e.cost)}">Sell</button>
						<button name="op" value="refund" class="ghost">Refund</button>
						<button name="op" value="delete" class="ghost">Delete</button>
					</form>
				</div>
			{:else}
				<p class="muted"><em>Unarmed.</em></p>
			{/each}
			<form class="buy" method="POST" action="?/buyItem" use:enhance={() => async ({ result, update }) => { await update({ reset: false }); if (result.type === 'success') newItem.name = ''; }}>
				<input type="hidden" name="target" value={selected.id} />
				<input type="hidden" name="item" value={JSON.stringify(newItem)} />
				<input bind:value={newItem.name} placeholder="New item" />
				<select bind:value={newItem.kind}>
					<option value="ranged">Ranged</option><option value="melee">Melee</option><option value="armour">Armour</option><option value="equipment">Equipment</option>
				</select>
				<input type="number" min="0" bind:value={newItem.cost} class="short" />
				<select bind:value={newItem.currency}><option value="ducats">D</option><option value="glory">Glory</option></select>
				<button disabled={!newItem.name}>Buy</button>
			</form>

			<div class="danger">
				<form method="POST" action="?/moveUnit" use:enhance={keep}>
					<input type="hidden" name="unitId" value={selected.id} />
					<button name="dir" value="up" class="ghost">↑ Up</button>
					<button name="dir" value="down" class="ghost">↓ Down</button>
				</form>
				<form method="POST" action="?/removeUnit" use:enhance={() => async ({ update }) => { await update(); select(null); }}>
					<input type="hidden" name="unitId" value={selected.id} />
					<button name="mode" value="sell" class="ghost" title="Half price back; gear to the stash">Dismiss (sell)</button>
					<button name="mode" value="refund" class="ghost" title="Full price back; gear to the stash">Refund</button>
					<button name="mode" value="none" class="ghost">Delete</button>
				</form>
			</div>
		{:else}
			<div class="empty">
				<p class="muted">Select a model to edit its profile, equipment, skills and scars.</p>
			</div>
		{/if}

		<details class="import">
			<summary>Import from Trench Companion</summary>
			<p class="muted">
				Replaces this roster and bank with your own warband from <a href="https://trench-companion.com" target="_blank" rel="noopener">Trench Companion</a>.
				Stat lines aren't in their export — fill them in here.
			</p>
			<form method="POST" action="?/importTc" use:enhance={keep}>
				<input name="link" placeholder="https://trench-companion.com/warband/detail/…" size="40" />
				<label class="check"><input type="checkbox" name="confirm" /> Replace this roster</label>
				<button>Import link</button>
			</form>
			<form method="POST" action="?/importFile" enctype="multipart/form-data" use:enhance={keep}>
				<input type="file" name="file" accept="application/json,.json" />
				<label class="check"><input type="checkbox" name="confirm" /> Replace this roster</label>
				<button>Import file</button>
			</form>
			{#if form && 'imported' in form}<p class="ok">Imported {form.imported}.</p>{/if}
			{#if form && 'importMessage' in form}<p class="error">{form.importMessage}</p>{/if}
		</details>
	</section>
</div>

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
	}
	.top h1 {
		margin: 0;
	}
	.top > div {
		flex: 1;
		min-width: 12rem;
	}
	.bank {
		display: flex;
		gap: 8px;
		align-items: end;
	}
	.bank input {
		width: 6em;
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		margin: 12px 0;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	.warn {
		color: var(--blood);
		font-weight: 600;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
		gap: 18px;
		align-items: start;
	}
	@media (max-width: 52rem) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.list {
		display: grid;
		gap: 6px;
	}
	h2 {
		margin: 10px 0 2px;
		font-size: 1.4rem;
	}
	h3 {
		margin: 16px 0 6px;
		font-variant-caps: small-caps;
		color: var(--blood);
	}
	.detail {
		position: sticky;
		top: 12px;
		padding: 12px 14px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	.detail-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.detail-head h2 {
		margin: 0;
	}
	form {
		display: grid;
		gap: 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 8px;
		align-items: end;
	}
	.grid.three {
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
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
	fieldset {
		border: 1px solid var(--rule);
		padding: 6px 10px 10px;
	}
	legend {
		color: var(--muted);
	}
	.stats-edit {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 6px;
	}
	.stats-edit input {
		width: 100%;
	}
	textarea {
		width: 100%;
	}
	.item {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 6px;
		align-items: center;
		padding: 4px 8px;
		background: var(--paper);
		border: 1px solid var(--rule);
	}
	.item form {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.item small {
		color: var(--muted);
	}
	.buy {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	.short {
		width: 5em;
	}
	.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
		padding: 2px 8px;
		font-size: 0.85rem;
	}
	.danger {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
		margin-top: 16px;
		padding-top: 10px;
		border-top: 1px solid var(--rule);
	}
	.danger form {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.add,
	.import {
		margin-top: 10px;
		padding: 8px 12px;
		border: 1px dashed var(--rule);
	}
	.import form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 8px;
	}
	summary {
		cursor: pointer;
		font-variant-caps: small-caps;
		color: var(--blood);
		font-weight: 600;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: end;
	}
	.empty {
		padding: 20px 0;
	}
	.muted,
	small {
		color: var(--muted);
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
</style>
