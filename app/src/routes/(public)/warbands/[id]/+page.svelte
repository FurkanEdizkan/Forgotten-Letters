<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import KeywordChips from '$lib/components/KeywordChips.svelte';
	import Portrait from '$lib/components/Portrait.svelte';
	import EquipmentDialog from '$lib/components/EquipmentDialog.svelte';
	import AddModelDialog, { type EntryRow } from '$lib/components/AddModelDialog.svelte';
	import { ARMOURY_ORDER, armouryCategory } from '$lib/builder';
	import { armourOf, builderState, entryOf, modelKeywords } from '$lib/builder-state';
	import { equipCheck, letters, recruitCheck, type ArmouryCategory, type ArmouryItem } from '$lib/warband-rules';
	import { rosterTotals } from '$lib/roster';

	let { data, form } = $props();

	const st = $derived(builderState(data.input));
	const live = $derived(page.data.snapshot?.warbands.find((x: { id: string }) => x.id === data.warband.id));
	const standing = $derived(page.data.snapshot?.standings.findIndex((s: { id: string }) => s.id === data.warband.id) ?? -1);
	const gamesPer = $derived(page.data.snapshot?.campaign.gamesPerPlayer ?? 0);
	const active = $derived(data.models.filter((m) => m.status === 'active'));
	const totals = $derived(rosterTotals(active as never, data.stash as never));
	const count = (cat: string) => active.filter((m) => m.category === cat).length;
	const profileOf = (id: string | null) => data.input.profiles.find((p) => p.id === id) ?? null;
	const picture = (m: { photo: string | null; art: string | null }) => m.photo ?? m.art;
	const initials = (s: string) =>
		s
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('');
	const money = (n: number, c: string) => `${n} ${c === 'glory' ? 'G' : 'D'}`;
	const SECTIONS = [
		['elite', 'Elites', 'Add Elite'],
		['troop', 'Troops', 'Add Troop'],
		['mercenary', 'Mercenaries', 'Add Mercenary']
	] as const;
	const LABEL: Record<ArmouryCategory, string> = Object.fromEntries(ARMOURY_ORDER) as Record<ArmouryCategory, string>;

	// svelte-ignore state_referenced_locally
	let selectedId = $state<string | null>(data.models.find((m) => m.status === 'active')?.id ?? data.models[0]?.id ?? null);
	const selected = $derived(data.models.find((m) => m.id === selectedId) ?? null);
	const profile = $derived(selected ? profileOf(selected.profileId) : null);
	const selState = $derived(selected ? st.state.models.find((m) => m.id === selected.id) ?? null : null);
	const keywords = $derived(
		selected ? modelKeywords({ ...selected, type: selected.type }, profile, st.rules, data.warband.fireteams) : []
	);
	const kitByCategory = $derived(
		selected
			? ARMOURY_ORDER.map(([cat, label]) => ({
					cat,
					label,
					items: selected.equipment.map((e, index) => ({ ...e, index })).filter((e) => armouryCategory(e, data.input.armoury) === cat)
				}))
			: []
	);
	const armourValue = $derived(selected ? armourOf({ armour: selected.stats.armour ?? profile?.stats?.armour }, selected.equipment, data.input.armoury, selState?.kit.fixed ?? []) : '—');
	const modelCost = (m: (typeof data.models)[number]) => {
		const d = (m.currency === 'ducats' ? m.cost : 0) + m.equipment.reduce((s, e) => s + (e.currency === 'ducats' ? e.cost : 0), 0);
		const g = (m.currency === 'glory' ? m.cost : 0) + m.equipment.reduce((s, e) => s + (e.currency === 'glory' ? e.cost : 0), 0);
		return { d, g };
	};
	const fireteamOf = (id: string) => data.warband.fireteams.filter((t) => t.members.includes(id)).map((t) => t.name);
	const held = $derived([...st.state.models.flatMap((m) => m.equipment), ...st.state.stash]);

	// Dialogs
	let adding = $state<null | 'elite' | 'troop' | 'mercenary'>(null);
	let addOpen = $state(false);
	let equipCat = $state<ArmouryCategory | null>(null);
	let equipOpen = $state(false);
	const addRows = $derived.by((): EntryRow[] => {
		if (!adding) return [];
		return data.input.profiles
			.filter((p) => p.category === adding)
			.map((p) => {
				const e = entryOf(p);
				const cap = st.rules.caps.find((c) => letters(c.name).includes(letters(p.name)) || letters(p.name).includes(letters(c.name)))?.max ?? p.availabilityMax;
				return {
					id: p.id,
					name: p.name,
					cost: p.cost,
					currency: p.currency,
					active: active.filter((m) => m.profileId === p.id || letters(m.type) === letters(p.name)).length,
					max: cap,
					picture: data.profileArt[p.id] ?? null,
					check: recruitCheck(e, st.state, st.rules, data.input.faction)
				};
			});
	});
	const equipItems = $derived(equipCat ? data.input.armoury.filter((a) => a.category === equipCat) : []);
	const equipCheckFor = (i: ArmouryItem) => {
		if (!selState) return { ok: false as const, reason: 'Choose a model' };
		// The variant's free item costs nothing the first time.
		const free = st.rules.freeItems.some((f) => letters(f) === letters(i.name)) && !held.some((h) => letters(h.name) === letters(i.name));
		return equipCheck(selState, free ? { ...i, cost: 0 } : i, st.state);
	};

	let detail = $state<HTMLElement>();
	function pick(id: string) {
		selectedId = id;
		if (window.matchMedia('(max-width: 60rem)').matches) requestAnimationFrame(() => detail?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
	}
	const keep = () => async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const closeMenus = (e: Event) => (e.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');

	async function setPicture(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f || !selected) return;
		const body = new FormData();
		body.set('image', f);
		await fetch(`/api/unit-photo/${selected.id}`, { method: 'POST', body });
		await invalidateAll();
	}
	let renaming = $state(false);
	let showIssues = $state(false);
</script>

<svelte:head><title>{data.warband.name} · Warband</title></svelte:head>

<div class="page tc">
	<div class="backdrop" aria-hidden="true">
		{#if data.warband.seal}
			<div class="blur" style:background-image="url({data.warband.seal.base})"></div>
			<div class="tint" style:--tint={data.warband.seal.low}></div>
		{/if}
	</div>

	<div class="titlebar">
		<div class="title-inner">
			{#if renaming && data.canEdit}
				<form method="POST" action="?/settings" class="rename" use:enhance={() => async ({ update }) => ((renaming = false), update({ reset: false }))}>
					<input name="name" value={data.warband.name} aria-label="Warband name" maxlength="80" />
					<button class="action small">Save</button>
				</form>
			{:else}
				<h1>{data.warband.name}</h1>
			{/if}
			{#if data.warband.unrestricted}<span class="tag unres" title="The builder does not check limits on numbers, cost and battlekit">Unrestricted</span>{/if}
			<details class="menu top">
				<summary aria-label="Warband menu">⋮</summary>
				<div class="menu-body">
					<a href="/warbands/{data.warband.id}/play">Enter Play Mode</a>
					<a href="/warbands/{data.warband.id}/print" target="_blank" rel="noopener">Print Warband</a>
					<a href="/warbands/{data.warband.id}/export">Export Warband</a>
					{#if data.canEdit}
						<button type="button" onclick={(e) => ((renaming = true), closeMenus(e))}>Rename Warband</button>
						<form method="POST" action="?/duplicate"><button>Duplicate as a new list</button></form>
						{#if data.warband.isList}
							<details class="confirm">
								<summary>Delete list…</summary>
								<form method="POST" action="?/deleteList"><button class="danger">Delete “{data.warband.name}” for good</button></form>
							</details>
						{/if}
					{/if}
				</div>
			</details>
		</div>
	</div>

	<div class="layout">
		<div class="left">
			<section class="panel summary">
				<div class="block">
					<div class="block-head">
						<h2>Warband</h2>
						{#if data.warband.player}<Portrait name={data.warband.player} portrait={data.warband.portrait} symbol={data.warband.symbol} faction={data.warband.faction} seal={data.warband.seal} size={44} />{/if}
					</div>
					{#if data.warband.player}<p><b>Player:</b> {data.warband.player}</p>{/if}
					<p><b>Faction:</b> {data.warband.factionName}{data.warband.variant ? ` — ${data.warband.variant}` : ''}</p>
					<p><b>Rating:</b> {totals.ducats} Ducats | {totals.glory} Glory</p>
					<p><b>Fielded:</b> Elite {count('elite')}, Troop {count('troop')}, Mercenary {count('mercenary')}, Total {active.length}</p>
					{#if data.issues.length}
						<button type="button" class="invalid" aria-expanded={showIssues} onclick={() => (showIssues = !showIssues)}>⚠ The warband is not valid</button>
						{#if showIssues}<ul class="issues">{#each data.issues as i (i)}<li>{i}</li>{/each}</ul>{/if}
					{/if}
				</div>
				<div class="block">
					<div class="block-head"><h2>Arsenal</h2><span class="bank">{data.warband.ducats} D<br />{data.warband.glory} G</span></div>
					<p><b>Strongbox:</b> {data.warband.ducats} Ducats | {data.warband.glory} Glory</p>
					{#each data.stash as s (s.id)}
						<div class="kititem">
							<span>{s.name}</span>
							<span class="cost">{money(s.cost, s.currency)}</span>
							{#if data.canEdit}
								<details class="menu">
									<summary aria-label="Item menu">⋮</summary>
									<div class="menu-body">
										<form method="POST" action="?/item" use:enhance={keep}>
											<input type="hidden" name="stash" value={s.id} />
											<input type="hidden" name="op" value="move" />
											<label>Move to fighter
												<select name="target" required>
													<option value="">Choose…</option>
													{#each active as m (m.id)}<option value={m.id}>{m.name || m.type}</option>{/each}
												</select>
											</label>
											<button>Move</button>
										</form>
										<form method="POST" action="?/item" use:enhance={keep}>
											<input type="hidden" name="stash" value={s.id} />
											<button name="op" value="sell">Sell Item</button>
											<button name="op" value="refund">Refund Item</button>
											<button name="op" value="delete">Delete Item</button>
										</form>
									</div>
								</details>
							{/if}
						</div>
					{:else}
						<p class="dim">No items in your arsenal</p>
					{/each}
				</div>
				{#if data.warband.inCampaign}
					<div class="block">
						<h2>Campaign — Carcass Front</h2>
						<p><b>Victory Points:</b> {live?.cvp ?? 0}{standing >= 0 ? ` (standing ${standing + 1})` : ''}</p>
						<p><b>Games:</b> {live?.games ?? 0}/{gamesPer}{live ? ` · ${live.wins} won` : ''}</p>
						{#if live}<p><b>Outposts:</b> {live.outposts.length} ({live.supplied.length} supplied)</p>{/if}
						<p><a href="/players/{data.warband.id}">Campaign Tracker →</a></p>
					</div>
					{#if live}
						<div class="block">
							<h2>Exploration</h2>
							<p><b>Dice:</b> {live.dice}D6{live.rerolls ? `, ${live.rerolls} reroll` : ''}{live.sets ? `, ${live.sets} set` : ''}</p>
							<p><b>Scouted:</b> {live.scouted.length} zones · <b>Omens:</b> {live.omens}</p>
						</div>
					{/if}
				{:else}
					<div class="block">
						<h2>Campaign</h2>
						<p class="dim">A list of your own. Use it for the campaign from <a href="/warbands">Your warbands</a>.</p>
					</div>
				{/if}
			</section>

			{#each SECTIONS as [cat, label, addLabel] (cat)}
				{@const list = data.models.filter((m) => m.category === cat)}
				<section class="list">
					<h2 class="band">
						{label}
						{#if data.canEdit}<button type="button" class="plus" aria-label={addLabel} onclick={() => ((adding = cat), (addOpen = true))}>+</button>{/if}
					</h2>
					{#each list as m (m.id)}
						{@const c = modelCost(m)}
						<div class="rowwrap" class:on={m.id === selectedId} class:gone={m.status !== 'active'}>
							<button type="button" class="row" onclick={() => pick(m.id)}>
								<span class="thumb">{#if picture(m)}<img src={picture(m)} alt="" />{:else}<span>{initials(m.type || m.name)}</span>{/if}</span>
								<span class="what">
									<strong>{m.type || m.name}</strong>
									{#if m.name && m.name !== m.type}<small>{m.name}</small>{/if}
									{#if fireteamOf(m.id).length}<small>{fireteamOf(m.id).join(' ')}</small>{/if}
									<span class="kit">{m.equipment.map((e) => e.name).join(', ') || 'No Battlekit'}</span>
								</span>
								<span class="cost">{c.d} D{#if c.g}<br />{c.g} G{/if}</span>
							</button>
							{#if data.canEdit}
								<details class="menu">
									<summary aria-label="Fighter menu">⋮</summary>
									<div class="menu-body">
										<form method="POST" action="?/copyFighter" use:enhance={keep}><input type="hidden" name="unit" value={m.id} /><button>Copy Fighter</button></form>
										<form method="POST" action="?/dismiss" use:enhance={keep}>
											<input type="hidden" name="unit" value={m.id} />
											<button name="how" value="refund">Refund Fighter</button>
											<button name="how" value="sell">Sell Fighter (half back)</button>
											<button name="how" value="none">Delete Fighter</button>
										</form>
									</div>
								</details>
							{/if}
						</div>
					{/each}
				</section>
			{/each}

			{#if st.rules.fireteams || data.warband.fireteams.length}
				<section class="list">
					<h2 class="band">
						Fireteams <small>{data.warband.fireteams.length}{st.rules.fireteams ? ` / ${st.rules.fireteams}` : ''}</small>
						{#if data.canEdit}
							<form method="POST" action="?/fireteam" use:enhance={keep}><button class="plus" name="op" value="new" aria-label="New Fireteam">+</button></form>
						{/if}
					</h2>
					{#each data.warband.fireteams as t, i (t.name)}
						<div class="panel fireteam">
							<strong>{t.name}</strong>
							<span>{t.members.map((id) => data.models.find((m) => m.id === id)?.type ?? '?').join(' + ') || 'No models yet'}</span>
							{#if data.canEdit}
								<form method="POST" action="?/fireteam" use:enhance={keep} class="inline">
									<input type="hidden" name="team" value={i} />
									{#if t.members.length < 2}
										<select name="unit" aria-label="Add to {t.name}">
											{#each active.filter((m) => !t.members.includes(m.id)) as m (m.id)}<option value={m.id}>{m.name || m.type}</option>{/each}
										</select>
										<button class="mini" name="op" value="join">Add</button>
									{/if}
									<button class="mini" name="op" value="disband">Disband</button>
								</form>
							{/if}
						</div>
					{/each}
				</section>
			{/if}

			{#if st.rules.paragraphs.length}
				<details class="panel rulespanel">
					<summary><h2>Faction Special Rules</h2></summary>
					{#each st.rules.paragraphs as p, i (i)}<p>{p.replace(/^\*\s*/, '')}</p>{/each}
				</details>
			{/if}

			<details class="panel rulespanel">
				<summary><h2>Notes &amp; Lore</h2></summary>
				{#if data.canEdit}
					<form method="POST" action="?/settings" use:enhance={keep} class="notes">
						<label>Warband Notes<textarea name="notes" rows="3">{data.warband.notes ?? ''}</textarea></label>
						<label>Warband Lore<textarea name="lore" rows="4">{data.warband.lore ?? ''}</textarea></label>
						<button class="action small">Save</button>
					</form>
				{:else}
					<p>{data.warband.notes ?? 'No Warband Notes'}</p>
					<p class="dim">{data.warband.lore ?? 'No Warband Lore'}</p>
				{/if}
			</details>

			{#if data.canEdit}
				<details class="panel rulespanel">
					<summary><h2>Advanced Options</h2></summary>
					<form method="POST" action="?/settings" use:enhance={keep} class="toggle">
						<input type="hidden" name="restrictionsForm" value="1" />
						<label><input type="checkbox" name="unrestricted" checked={data.warband.unrestricted} onchange={(e) => e.currentTarget.form?.requestSubmit()} /> Remove Restrictions</label>
						<small class="dim">The builder then does not check limits on numbers, cost, available hands, and other rules on battlekit and models.</small>
					</form>
					<form method="POST" action="?/settings" use:enhance={keep} class="toggle">
						<input type="hidden" name="explorationForm" value="1" />
						<label><input type="checkbox" name="openExploration" checked={data.warband.openExploration} onchange={(e) => e.currentTarget.form?.requestSubmit()} /> Enable Open Exploration</label>
						<small class="dim">Battlekit normally found only through Exploration may be bought.</small>
					</form>
					<form method="POST" action="?/settings" use:enhance={keep} class="bankform">
						<label>Strongbox Ducats <input name="ducats" type="number" value={data.warband.ducats} /></label>
						<label>Glory <input name="glory" type="number" value={data.warband.glory} /></label>
						<button class="action small">Set</button>
					</form>
				</details>
			{/if}
		</div>

		<aside class="detail panel" bind:this={detail}>
			{#if selected}
				{@const c = modelCost(selected)}
				<div class="detail-bar">
					<strong>{selected.type}</strong>
					<span>{c.d} D{#if c.g} | {c.g} G{/if}</span>
				</div>
				<div class="detail-head">
					<div>
						<p><b>Name:</b> {selected.name || '—'}</p>
						<p><b>Type:</b> {selected.type}</p>
						<p><b>Base Cost:</b> {money(selected.cost, selected.currency)}</p>
						{#if fireteamOf(selected.id).length}<p><b>Fireteam:</b> {fireteamOf(selected.id).join(', ')}</p>{/if}
						{#if selected.stats.base}<p><b>Base:</b> {selected.stats.base}</p>{/if}
					</div>
					<div class="picture">
						{#if picture(selected)}<img src={picture(selected)} alt={selected.name || selected.type} />{:else}<span>{initials(selected.type || selected.name)}</span>{/if}
						{#if data.canEdit}<label class="pic">Change picture<input type="file" accept="image/png,image/jpeg,image/webp" onchange={setPicture} /></label>{/if}
					</div>
				</div>
				<div class="stats">
					<div><span>Movement</span><strong>{selected.stats.movement ?? '—'}</strong></div>
					<div><span>Melee</span><strong>{selected.stats.melee ?? '—'}</strong></div>
					<div><span>Ranged</span><strong>{selected.stats.ranged ?? '—'}</strong></div>
					<div><span>Armour</span><strong>{armourValue}</strong></div>
				</div>
				{#if keywords.length}
					<h3>Keywords</h3>
					<KeywordChips {keywords} glossary={data.glossary} dark />
				{/if}

				{#if st.rules.upgrades.length || selState?.kit.swap}
					<h3>Upgrades</h3>
					{#each [...st.rules.upgrades.map((u) => ({ name: u.name, cost: u.cost, text: u.text, max: u.max })), ...(selState?.kit.swap ? [{ name: selState.kit.swap.to, cost: selState.kit.swap.extra, text: `Replaces ${selState.kit.swap.from}.`, max: null }] : [])] as u (u.name)}
						{@const taken = active.filter((m) => m.upgrades.includes(u.name)).length}
						<details class="upgrade">
							<summary>
								{#if data.canEdit}
									<form method="POST" action="?/upgrade" use:enhance={keep} class="inline">
										<input type="hidden" name="unit" value={selected.id} />
										<input type="hidden" name="name" value={u.name} />
										<input type="checkbox" name="on" aria-label="Take {u.name}" checked={selected.upgrades.includes(u.name)} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
									</form>
								{/if}
								<span>{u.name}{u.cost ? ` — ${u.cost} D` : ''}{u.max != null ? ` · ${taken}/${u.max}` : ''}</span>
							</summary>
							<p>{u.text}</p>
						</details>
					{/each}
				{/if}

				<h3>Battlekit</h3>
				{#if profile?.battlekitNote}<p class="dim">{profile.battlekitNote}</p>{/if}
				{#each kitByCategory as g (g.cat)}
					<div class="kitgroup">
						<h4>
							{g.label}
							{#if data.canEdit}<button type="button" class="plus" aria-label="Add {g.label}" onclick={() => ((equipCat = g.cat), (equipOpen = true))}>+</button>{/if}
						</h4>
						{#each g.items as it (it.index)}
							<div class="kititem">
								<span>{it.name}</span>
								<span class="cost">{it.cost ? money(it.cost, it.currency) : (selState?.kit.fixed ?? []).some((f) => letters(f) === letters(it.name)) ? 'fixed' : 'free'}</span>
								{#if data.canEdit}
									<details class="menu">
										<summary aria-label="Item menu">⋮</summary>
										<div class="menu-body">
											<form method="POST" action="?/item" use:enhance={keep}>
												<input type="hidden" name="unit" value={selected.id} />
												<input type="hidden" name="index" value={it.index} />
												<label>Fighter
													<select name="target">
														<option value="stash">— the arsenal —</option>
														{#each active.filter((m) => m.id !== selected.id) as m (m.id)}<option value={m.id}>{m.name || m.type}</option>{/each}
													</select>
												</label>
												<button name="op" value="move">Move Item</button>
												<button name="op" value="copy">Copy Item (buy another)</button>
											</form>
											<form method="POST" action="?/item" use:enhance={keep}>
												<input type="hidden" name="unit" value={selected.id} />
												<input type="hidden" name="index" value={it.index} />
												<button name="op" value="sell">Sell Item</button>
												<button name="op" value="refund">Refund Item</button>
												<button name="op" value="delete">Delete Item</button>
											</form>
										</div>
									</details>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
				{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

				<h3>Campaign</h3>
				{#if data.canEdit}
					<form method="POST" action="?/unit" class="campaign" use:enhance={keep}>
						<input type="hidden" name="unit" value={selected.id} />
						<label>Name <input name="name" value={selected.name} maxlength="80" /></label>
						<label>Experience <input name="experience" type="number" min="0" value={selected.experience} /></label>
						<label class="wide">Battle Scars and Injuries <small>(one per line)</small><textarea name="injuries" rows="2">{selected.injuries.join('\n')}</textarea></label>
						<label class="wide">Advancements <small>(one per line)</small><textarea name="skills" rows="2">{selected.skills.join('\n')}</textarea></label>
						<label>Fighter Status
							<select name="status" value={selected.status}>
								<option value="active">Active</option>
								<option value="dead">Dead</option>
								<option value="retired">Retired</option>
							</select>
						</label>
						<label class="wide">Notes<textarea name="notes" rows="2">{selected.notes ?? ''}</textarea></label>
						<button class="action small">Save</button>
					</form>
					{#if selected.category !== 'mercenary'}
						<form method="POST" action="?/rank" use:enhance={keep} class="rank">
							<input type="hidden" name="unit" value={selected.id} />
							<span><b>Fighter Rank:</b> {selected.category === 'elite' ? 'Elite' : 'Troop'}</span>
							<button class="mini">{selected.category === 'elite' ? 'Demote' : 'Promote'}</button>
						</form>
					{/if}
				{:else}
					<p><b>Experience:</b> {selected.experience}</p>
					<p><b>Battle Scars:</b> {selected.injuries.join(', ') || '—'}</p>
					<p><b>Advancements:</b> {selected.skills.join(', ') || '—'}</p>
					<p><b>Fighter Status:</b> {selected.status === 'active' ? 'Active' : selected.status === 'dead' ? 'Dead' : 'Retired'}</p>
					<p><b>Fighter Rank:</b> {selected.category === 'elite' ? 'Elite' : selected.category === 'mercenary' ? 'Mercenary' : 'Troop'}</p>
				{/if}

				{#if profile?.abilities.length}
					<h3>Abilities</h3>
					{#each profile.abilities as a (a.name)}<p class="ability"><b>{a.name}:</b> {a.text}</p>{/each}
				{/if}
				{#if profile?.description}
					<h3>Lore</h3>
					<p class="dim">{profile.description}</p>
				{/if}
			{:else}
				<p class="dim">{data.canEdit ? 'Recruit a model with the + on Elites, Troops or Mercenaries.' : 'Choose a model to see it here.'}</p>
			{/if}
		</aside>
	</div>
</div>

{#if data.canEdit}
	<AddModelDialog
		bind:open={addOpen}
		title={adding === 'elite' ? 'Add Elite' : adding === 'troop' ? 'Add Troop' : 'Add Mercenary'}
		rows={addRows}
		onrecruited={(id) => id && (selectedId = id)}
	/>
	{#if selected && equipCat}
		<EquipmentDialog
			bind:open={equipOpen}
			title={LABEL[equipCat]}
			items={equipItems}
			check={equipCheckFor}
			{held}
			unitId={selected.id}
			glossary={data.glossary}
			rulesText={(i) => i.text ?? null}
		/>
	{/if}
{/if}

<style>
	/* Trench Companion's warband page: dark panels over a blurred warband image, red section bands. */
	.page {
		--panel: rgba(38, 35, 30, 0.94);
		--panel-2: rgba(52, 48, 41, 0.96);
		--line: rgba(236, 229, 211, 0.12);
		position: relative;
		min-height: 100vh;
		background: var(--night);
		color: var(--bone);
		isolation: isolate;
		padding-bottom: 48px;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: radial-gradient(circle at 70% 30%, #2a261d, var(--night) 70%);
	}
	.blur {
		position: absolute;
		top: 40vh;
		left: 62%;
		width: 90vmax;
		height: 90vmax;
		transform: translate(-50%, -50%);
		background-size: 3200% 100%;
		background-position: 0 50%;
		filter: blur(70px);
		opacity: 0.28;
	}
	.tint {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 62% 45%, var(--tint), transparent 55%);
		mix-blend-mode: soft-light;
		opacity: 0.5;
	}
	.titlebar {
		background: #6b1a14;
		border-bottom: 1px solid rgba(0, 0, 0, 0.4);
	}
	.title-inner {
		display: flex;
		align-items: center;
		gap: 14px;
		max-width: 76rem;
		margin: 0 auto;
		padding: 10px clamp(16px, 4vw, 40px);
	}
	h1 {
		margin: 0;
		font-family: var(--font-body);
		font-size: 1.5rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.rename {
		display: flex;
		gap: 8px;
	}
	.rename input {
		font: inherit;
		font-size: 1.2rem;
		padding: 4px 8px;
		background: #14120e;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.3);
	}
	.tag.unres {
		font-size: 0.78rem;
		padding: 1px 8px;
		border: 1px solid currentColor;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #f4d6cf;
	}
	/* ⋮ menus: native <details>, so they work with the keyboard and without script. */
	.menu {
		position: relative;
		margin-left: auto;
	}
	.menu summary {
		list-style: none;
		cursor: pointer;
		padding: 2px 10px;
		font-size: 1.2rem;
		line-height: 1;
		color: var(--bone);
	}
	.menu summary::-webkit-details-marker {
		display: none;
	}
	.menu-body {
		position: absolute;
		right: 0;
		top: 100%;
		z-index: 20;
		display: grid;
		gap: 2px;
		min-width: 14rem;
		padding: 6px;
		background: #2e2a24;
		border: 1px solid var(--line);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
	}
	.menu-body a,
	.menu-body button,
	.menu-body summary {
		display: block;
		width: 100%;
		padding: 6px 10px;
		background: none;
		border: 0;
		color: var(--bone);
		font: inherit;
		font-size: 0.9rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.menu-body a:hover,
	.menu-body button:hover {
		background: rgba(236, 229, 211, 0.08);
	}
	.menu-body form {
		display: grid;
		gap: 2px;
	}
	.menu-body label {
		display: grid;
		gap: 3px;
		padding: 4px 10px;
		font-size: 0.8rem;
		opacity: 0.85;
	}
	.menu-body select {
		font: inherit;
		background: #14120e;
		color: var(--bone);
		border: 1px solid var(--line);
	}
	.danger {
		color: #ff9b8f !important;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 32rem) minmax(0, 1fr);
		gap: 22px;
		max-width: 76rem;
		margin: 22px auto 0;
		padding: 0 clamp(16px, 4vw, 40px);
		align-items: start;
	}
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
	}
	.summary .block {
		padding: 12px 14px;
		border-bottom: 1px solid var(--line);
	}
	.summary p {
		margin: 2px 0;
		font-size: 0.92rem;
	}
	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1.3rem;
		margin: 0 0 4px;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.bank {
		text-align: right;
		font-size: 0.85rem;
	}
	.invalid {
		margin-top: 6px;
		padding: 0;
		background: none;
		border: 0;
		color: #f2c14e;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.issues {
		margin: 4px 0 0;
		padding-left: 1.2em;
		font-size: 0.86rem;
		color: #f4d6cf;
	}
	.dim {
		color: rgba(236, 229, 211, 0.6);
	}
	.list {
		margin-top: 14px;
	}
	.band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin: 0;
		padding: 7px 12px;
		background: #6b1a14;
		font-size: 1rem;
		font-weight: 600;
	}
	.band small {
		font-weight: 400;
		opacity: 0.75;
	}
	.band form {
		margin: 0;
	}
	.plus {
		background: none;
		border: 0;
		color: var(--bone);
		font-size: 1.3rem;
		line-height: 1;
		padding: 0 4px;
		cursor: pointer;
	}
	.rowwrap {
		display: flex;
		align-items: stretch;
		background: var(--panel);
		border-bottom: 1px solid var(--line);
	}
	.rowwrap.on {
		background: #7d1f18;
	}
	.rowwrap.gone {
		opacity: 0.5;
	}
	.rowwrap .menu {
		align-self: center;
	}
	.row {
		text-transform: none;
		letter-spacing: 0;
		flex: 1;
		display: grid;
		grid-template-columns: 52px 1fr auto;
		gap: 12px;
		align-items: center;
		padding: 6px 4px 6px 6px;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.thumb {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		overflow: hidden;
		background: #3a352d;
		font-family: var(--font-title);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.what {
		display: grid;
		min-width: 0;
		line-height: 1.25;
	}
	.what small {
		font-size: 0.78rem;
		opacity: 0.75;
	}
	.kit {
		font-size: 0.8rem;
		opacity: 0.85;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cost {
		font-size: 0.86rem;
		text-align: right;
		white-space: nowrap;
	}
	.fireteam {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-top: 0;
	}
	.fireteam .inline {
		margin-left: auto;
	}
	.inline {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		margin: 0;
	}
	.rulespanel {
		margin-top: 14px;
		padding: 10px 14px;
	}
	.rulespanel summary {
		cursor: pointer;
		list-style: none;
	}
	.rulespanel summary h2 {
		display: inline;
	}
	.rulespanel p {
		font-size: 0.9rem;
		margin: 8px 0;
	}
	.notes,
	.bankform {
		display: grid;
		gap: 8px;
		margin-top: 8px;
	}
	.notes label,
	.bankform label {
		display: grid;
		gap: 3px;
	}
	.toggle {
		display: grid;
		gap: 2px;
		margin-top: 10px;
	}
	.toggle label {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	textarea,
	input:not([type='checkbox']):not([type='file']),
	select {
		background: #14120e;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.25);
		padding: 6px 8px;
		font: inherit;
	}
	.detail {
		position: sticky;
		top: 12px;
		padding: 0 14px 14px;
	}
	.detail-bar {
		display: flex;
		justify-content: space-between;
		margin: 0 -14px 10px;
		padding: 8px 14px;
		background: #7d1f18;
	}
	.detail-head {
		display: grid;
		grid-template-columns: 1fr 9rem;
		gap: 12px;
	}
	.detail-head p {
		margin: 2px 0;
		font-size: 0.92rem;
	}
	.picture {
		display: grid;
		gap: 6px;
		align-content: start;
	}
	.picture img,
	.picture > span {
		width: 9rem;
		height: 9rem;
		object-fit: cover;
		display: grid;
		place-items: center;
		background: #3a352d;
		font-family: var(--font-title);
		font-size: 2.2rem;
	}
	.pic {
		font-size: 0.78rem;
		cursor: pointer;
		text-decoration: underline;
	}
	.pic input {
		position: absolute;
		opacity: 0;
		width: 1px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin: 12px 0;
	}
	.stats div {
		display: grid;
		gap: 3px;
		text-align: center;
		font-size: 0.78rem;
	}
	.stats strong {
		padding: 6px 2px;
		background: var(--panel-2);
		border: 1px solid var(--line);
		font-size: 0.95rem;
	}
	h3 {
		margin: 16px 0 6px;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1.25rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.kitgroup {
		margin-bottom: 6px;
		background: var(--panel-2);
	}
	.kitgroup h4 {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0;
		padding: 6px 10px;
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
		background: rgba(0, 0, 0, 0.18);
	}
	.kititem {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 10px;
		font-size: 0.9rem;
	}
	.kititem .cost {
		margin-left: auto;
	}
	.kititem .menu {
		margin-left: 0;
	}
	.upgrade {
		margin-bottom: 6px;
		padding: 6px 10px;
		background: var(--panel-2);
	}
	.upgrade summary {
		display: flex;
		gap: 10px;
		align-items: center;
		cursor: pointer;
	}
	.upgrade p {
		margin: 6px 0 0;
		font-size: 0.88rem;
		color: rgba(236, 229, 211, 0.75);
	}
	.campaign {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.campaign label {
		display: grid;
		gap: 3px;
		font-size: 0.88rem;
	}
	.campaign .wide {
		grid-column: 1 / -1;
	}
	.rank {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-top: 8px;
	}
	.ability {
		font-size: 0.9rem;
	}
	.action {
		justify-self: start;
		background: #8f1f18;
		color: var(--bone);
		border: 1px solid #b3261e;
		padding: 6px 14px;
		font: inherit;
		cursor: pointer;
	}
	.mini {
		padding: 3px 9px;
		background: transparent;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.3);
		font: inherit;
		font-size: 0.82rem;
		cursor: pointer;
	}
	.error {
		color: #ff9b8f;
	}
	@media (max-width: 60rem) {
		.layout {
			grid-template-columns: 1fr;
		}
		.detail {
			position: static;
		}
	}
	@media (max-width: 480px) {
		.detail-head {
			grid-template-columns: 1fr;
		}
		.picture img,
		.picture > span {
			width: 100%;
			height: 12rem;
		}
		.campaign {
			grid-template-columns: 1fr;
		}
	}
</style>
