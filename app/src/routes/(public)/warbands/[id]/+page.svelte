<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import KeywordChips from '$lib/components/KeywordChips.svelte';
	import Seal from '$lib/components/Seal.svelte';
	import Portrait from '$lib/components/Portrait.svelte';
	import { ARMOURY_ORDER, armouryCategory, canTake } from '$lib/builder';
	import { rosterTotals } from '$lib/roster';

	let { data, form } = $props();

	const live = $derived(page.data.snapshot?.warbands.find((x: { id: string }) => x.id === data.warband.id));
	const standing = $derived(page.data.snapshot?.standings.findIndex((s: { id: string }) => s.id === data.warband.id) ?? -1);
	const gamesPer = $derived(page.data.snapshot?.campaign.gamesPerPlayer ?? 0);
	const active = $derived(data.models.filter((m) => m.status === 'active'));
	const totals = $derived(rosterTotals(active as never, data.stash as never));
	const count = (cat: string) => active.filter((m) => m.category === cat).length;
	const profileOf = (id: string | null) => data.profiles.find((p) => p.id === id) ?? null;
	const picture = (m: { photo: string | null; art: string | null }) => m.photo ?? m.art;
	const initials = (s: string) => s.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
	const SECTIONS = [
		['elite', 'Elites'],
		['troop', 'Troops'],
		['mercenary', 'Mercenaries']
	] as const;
	const STATS = [
		['movement', 'Movement'],
		['ranged', 'Ranged'],
		['melee', 'Melee'],
		['armour', 'Armour'],
		['base', 'Base']
	] as const;

	// svelte-ignore state_referenced_locally
	let selectedId = $state<string | null>(data.models.find((m) => m.status === 'active')?.id ?? data.models[0]?.id ?? null);
	const selected = $derived(data.models.find((m) => m.id === selectedId) ?? null);
	const profile = $derived(selected ? profileOf(selected.profileId) : null);
	const kitByCategory = $derived(
		selected
			? ARMOURY_ORDER.map(([cat, label]) => ({
					cat,
					label,
					items: selected.equipment.map((e, index) => ({ ...e, index })).filter((e) => armouryCategory(e, data.armoury) === cat)
				}))
			: []
	);
	let recruiting = $state(false);
	let shopping = $state(false);
	let detail = $state<HTMLElement>();

	function pick(id: string) {
		selectedId = id;
		shopping = false;
		// On a phone the detail sits below the list; bring it into view.
		if (window.matchMedia('(max-width: 60rem)').matches) requestAnimationFrame(() => detail?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
	}
	const keep = () => async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const afterRecruit = () => async ({ result, update }: { result: { type: string; data?: { recruited?: string | null } }; update: (o: { reset: boolean }) => Promise<void> }) => {
		await update({ reset: true });
		if (result.type === 'success' && result.data?.recruited) selectedId = result.data.recruited;
		recruiting = false;
	};

	async function setPicture(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f || !selected) return;
		const body = new FormData();
		body.set('image', f);
		await fetch(`/api/unit-photo/${selected.id}`, { method: 'POST', body });
		await invalidateAll();
	}
	const recruitable = $derived(
		data.profiles
			.map((p) => ({ p, r: data.recruit.find((r) => r.id === p.id) }))
			.filter(({ p }) => (p.faction === data.warband.faction && (!p.variant || p.variant === data.warband.variant)) || p.faction === 'mercenaries')
	);
</script>

<svelte:head><title>{data.warband.name} · Warband</title></svelte:head>

<div class="page">
	<div class="backdrop" aria-hidden="true">
		{#if live?.seal}
			<div class="blur" style:background-image="url({live.seal.base})"></div>
			<div class="tint" style:--tint={live.seal.low}></div>
		{/if}
	</div>

	<div class="titlebar">
		<div class="title-inner">
			<h1>{data.warband.name}</h1>
			{#if data.warband.unrestricted}<span class="tag unres" title="The builder does not check limits on numbers, cost and battlekit">Unrestricted</span>{/if}
			{#if data.canEdit}<span class="tag">You can edit this warband</span>{/if}
		</div>
	</div>

	<div class="layout">
		<div class="left">
			<section class="panel summary">
				<div class="block">
					<div class="block-head">
						<h2>Warband</h2>
						<Portrait name={data.warband.player} portrait={data.warband.portrait} symbol={data.warband.symbol} faction={data.warband.faction} seal={live?.seal} size={44} />
					</div>
					<p><b>Player:</b> {data.warband.player}</p>
					<p><b>Faction:</b> {data.warband.factionName}{data.warband.variant ? ` — ${data.warband.variant}` : ''}</p>
					{#if data.warband.patron}<p><b>Patron:</b> {data.warband.patron}</p>{/if}
					<p><b>Rating:</b> {totals.ducats} Ducats | {totals.glory} Glory</p>
					<p><b>Fielded:</b> Elite {count('elite')}, Troop {count('troop')}, Mercenary {count('mercenary')}, Total {active.length}</p>
				</div>
				<div class="block">
					<div class="block-head"><h2>Arsenal</h2><span class="bank">{data.warband.ducats} D<br />{data.warband.glory} G</span></div>
					<p><b>Strongbox:</b> {data.warband.ducats} Ducats | {data.warband.glory} Glory</p>
					{#if data.stash.length}
						<p>{data.stash.map((s) => s.name).join(', ')}</p>
					{:else}
						<p class="dim">No items in the arsenal</p>
					{/if}
				</div>
				<div class="block">
					<h2>Campaign — Carcass Front</h2>
					<p><b>Victory Points:</b> {live?.cvp ?? 0}{standing >= 0 ? ` (standing ${standing + 1})` : ''}</p>
					<p><b>Games:</b> {live?.games ?? 0}/{gamesPer}{live ? ` · ${live.wins} won` : ''}</p>
					{#if live}<p><b>Outposts:</b> {live.outposts.length} ({live.supplied.length} supplied)</p>{/if}
					<p><a href="/players/{data.warband.id}">Campaign Tracker →</a></p>
				</div>
				<div class="block">
					<h2>Exploration</h2>
					{#if live}
						<p><b>Dice:</b> {live.dice}D6{live.rerolls ? `, ${live.rerolls} reroll` : ''}{live.sets ? `, ${live.sets} set` : ''}</p>
						<p><b>Scouted:</b> {live.scouted.length} zones · <b>Omens:</b> {live.omens}</p>
					{/if}
				</div>
			</section>

			{#if data.canEdit && (data.warnings.length || data.warband.ducats < 0 || data.warband.glory < 0)}
				<ul class="warnings">
					{#each data.warnings as w (w)}<li>{w}</li>{/each}
					{#if data.warband.ducats < 0 || data.warband.glory < 0}<li>The strongbox is overdrawn: the Campaign Master sets it (starting warbands have 700 Ducats).</li>{/if}
				</ul>
			{/if}

			{#each SECTIONS as [cat, label] (cat)}
				{@const list = data.models.filter((m) => m.category === cat)}
				{#if list.length}
					<section class="list">
						<h2 class="band">{label}</h2>
						{#each list as m (m.id)}
							<button type="button" class="row" class:on={m.id === selectedId} class:gone={m.status !== 'active'} onclick={() => pick(m.id)}>
								<span class="thumb">{#if picture(m)}<img src={picture(m)} alt="" />{:else}<span>{initials(m.type || m.name)}</span>{/if}</span>
								<span class="what">
									<strong>{m.type || m.name}</strong>
									{#if m.name && m.name !== m.type}<small>{m.name}</small>{/if}
									<span class="kit">{m.equipment.map((e) => e.name).join(', ') || '—'}</span>
								</span>
								<span class="cost">{m.cost + m.equipment.reduce((s, e) => s + (e.currency === m.currency ? e.cost : 0), 0)} {m.currency === 'glory' ? 'G' : 'D'}</span>
							</button>
						{/each}
					</section>
				{/if}
			{:else}{/each}

			{#if !data.models.length}<p class="panel empty">No models mustered yet.</p>{/if}

			{#if data.canEdit}
				<div class="recruit">
					{#if !recruiting}
						<button type="button" class="action" onclick={() => (recruiting = true)}>Recruit a model</button>
					{:else}
						<form method="POST" action="?/recruit" class="panel picker" use:enhance={afterRecruit}>
							<h2>Recruit</h2>
							{#if !recruitable.length}<p class="dim">No rules are loaded for this faction yet (Admin → Rules).</p>{/if}
							<div class="options">
								{#each recruitable as { p, r } (p.id)}
									<label class="option" class:full={r?.left === 0}>
										<input type="radio" name="profile" value={p.id} disabled={r?.left === 0} required />
										<span><strong>{p.name}</strong><small>{p.category === 'mercenary' ? 'Mercenary' : p.category === 'elite' ? 'Elite' : 'Troop'} · {r?.fielded ?? 0}{p.availabilityMax == null ? '' : `/${p.availabilityMax}`} fielded</small></span>
										<span class="cost">{p.cost} {p.currency === 'glory' ? 'G' : 'D'}</span>
									</label>
								{/each}
							</div>
							<label class="name">Name (optional) <input name="name" placeholder="e.g. Brother Anselm" /></label>
							<label class="check"><input type="checkbox" name="pay" value="no" /> Don't take it from the strongbox</label>
							<div class="buttons"><button class="action">Recruit</button><button type="button" class="ghost" onclick={() => (recruiting = false)}>Cancel</button></div>
						</form>
					{/if}
				</div>
				<form method="POST" action="?/restrictions" class="restrict" use:enhance>
					<label>
						<input type="checkbox" name="unrestricted" checked={data.warband.unrestricted} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
						Remove restrictions
					</label>
					<small class="dim">The builder then does not check limits on numbers, cost and battlekit.</small>
					<noscript><button class="ghost">Save</button></noscript>
				</form>
			{/if}
		</div>

		<aside class="detail panel" bind:this={detail}>
			{#if selected}
				<div class="detail-head">
					<div>
						<p><b>Name:</b> {selected.name || '—'}</p>
						<p><b>Type:</b> {selected.type}</p>
						<p><b>Base cost:</b> {selected.cost} {selected.currency === 'glory' ? 'Glory' : 'Ducats'}</p>
						{#if selected.stats.base}<p><b>Base:</b> {selected.stats.base}</p>{/if}
					</div>
					<div class="picture">
						{#if picture(selected)}<img src={picture(selected)} alt={selected.name} />{:else}<span>{initials(selected.type || selected.name)}</span>{/if}
						{#if data.canEdit}<label class="pic">Change picture<input type="file" accept="image/png,image/jpeg,image/webp" onchange={setPicture} /></label>{/if}
					</div>
				</div>

				<div class="stats">
					{#each STATS.slice(0, 4) as [k, label] (k)}
						<div><span>{label}</span><strong>{selected.stats[k] ?? profile?.stats[k] ?? '—'}</strong></div>
					{/each}
				</div>
				{#if profile?.keywords.length}
					<h3>Keywords</h3>
					<KeywordChips keywords={profile.keywords} glossary={data.glossary} dark />
				{/if}

				<h3>Battlekit</h3>
				{#if profile?.battlekitNote}<p class="dim">{profile.battlekitNote}</p>{/if}
				{#each kitByCategory as g (g.cat)}
					{#if g.items.length}
						<div class="kitgroup">
							<h4>{g.label}</h4>
							{#each g.items as it (it.index)}
								<div class="kititem">
									<span>{it.name}</span>
									<span class="cost">{it.cost} {it.currency === 'glory' ? 'G' : 'D'}</span>
									{#if data.canEdit}
										<form method="POST" action="?/item" use:enhance={keep}>
											<input type="hidden" name="unit" value={selected.id} />
											<input type="hidden" name="index" value={it.index} />
											<button name="op" value="sell" class="mini" title="Sell for half">Sell</button>
											<button name="op" value="refund" class="mini" title="Full refund (a mistake)">Refund</button>
											<button name="op" value="move" class="mini" title="Put in the arsenal">To arsenal</button>
										</form>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{/each}
				{#if !selected.equipment.length}<p class="dim">No battlekit.</p>{/if}
				{#if data.canEdit}
					{#if !shopping}
						<button type="button" class="action small" onclick={() => (shopping = true)}>Add battlekit</button>
					{:else}
						<form method="POST" action="?/buy" class="shop" use:enhance={keep}>
							<input type="hidden" name="unit" value={selected.id} />
							<select name="item" required aria-label="Battlekit">
								<option value="">Choose from the {data.warband.factionName} armoury…</option>
								{#each ARMOURY_ORDER as [cat, label] (cat)}
									{@const opts = data.armoury.filter((a) => a.category === cat)}
									{#if opts.length}
										<optgroup {label}>
											{#each opts as a (a.id)}
												<option value={a.id} disabled={!data.warband.unrestricted && !canTake(a, selected.equipment)}>{a.name} — {a.cost} {a.currency === 'glory' ? 'G' : 'D'}{a.restrictions ? ` (${a.restrictions})` : ''}</option>
											{/each}
										</optgroup>
									{/if}
								{/each}
							</select>
							<button class="action small">Buy</button>
							<button type="button" class="ghost small" onclick={() => (shopping = false)}>Done</button>
						</form>
					{/if}
					{#if form?.message}<p class="error">{form.message}</p>{/if}
				{/if}

				<h3>Campaign</h3>
				{#if data.canEdit}
					<form method="POST" action="?/unit" class="campaign" use:enhance={keep}>
						<input type="hidden" name="unit" value={selected.id} />
						<label>Name <input name="name" value={selected.name} /></label>
						<label>Experience <input name="experience" type="number" min="0" value={selected.experience} /></label>
						<label>Fighter status
							<select name="status" value={selected.status}>
								<option value="active">Active</option>
								<option value="dead">Dead</option>
								<option value="retired">Retired</option>
							</select>
						</label>
						<label class="wide">Battle scars and injuries <small>(one per line)</small><textarea name="injuries" rows="2">{selected.injuries.join('\n')}</textarea></label>
						<label class="wide">Advancements and skills <small>(one per line)</small><textarea name="skills" rows="2">{selected.skills.join('\n')}</textarea></label>
						<label class="wide">Upgrades <small>(one per line)</small><textarea name="upgrades" rows="2">{selected.upgrades.join('\n')}</textarea></label>
						<label class="wide">Notes<textarea name="notes" rows="2">{selected.notes ?? ''}</textarea></label>
						<button class="action small">Save</button>
					</form>
				{:else}
					<p><b>Experience:</b> {selected.experience}</p>
					<p><b>Battle scars:</b> {selected.injuries.join(', ') || '—'}</p>
					<p><b>Advancements:</b> {[...selected.skills, ...selected.upgrades].join(', ') || '—'}</p>
					<p><b>Fighter status:</b> {selected.status === 'active' ? 'Active' : selected.status === 'dead' ? 'Dead' : 'Retired'}</p>
				{/if}
				<p><b>Fighter rank:</b> {selected.category === 'elite' ? 'Elite' : selected.category === 'mercenary' ? 'Mercenary' : 'Troop'}</p>

				{#if profile?.abilities.length}
					<h3>Abilities</h3>
					{#each profile.abilities as a (a.name)}<p class="ability"><b>{a.name}:</b> {a.text}</p>{/each}
				{/if}
				{#if profile?.description || (!data.canEdit && selected.notes)}
					<h3>Notes and lore</h3>
					{#if selected.notes && !data.canEdit}<p>{selected.notes}</p>{/if}
					{#if profile?.description}<p class="dim">{profile.description}</p>{/if}
				{/if}

				{#if data.canEdit}
					<form method="POST" action="?/dismiss" class="dismiss" use:enhance={keep}>
						<input type="hidden" name="unit" value={selected.id} />
						<span>Remove from the warband:</span>
						<button name="how" value="sell" class="mini">Sell (half back)</button>
						<button name="how" value="refund" class="mini">Refund</button>
						<button name="how" value="none" class="mini">Dismiss</button>
					</form>
				{/if}
			{:else}
				<p class="dim">Choose a model to see it here.</p>
			{/if}
		</aside>
	</div>
</div>

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
	}
	/* Behind the warband page only (never over the site header above it). */
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: radial-gradient(circle at 70% 30%, #2a261d, var(--night) 70%);
	}
	/* The warband's seal, huge and out of focus, tinted with its own light: a room lit by it. */
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
	.tag {
		margin-left: auto;
		font-size: 0.78rem;
		color: #f4d6cf;
	}
	.tag.unres {
		padding: 1px 8px;
		border: 1px solid currentColor;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.tag.unres + .tag {
		margin-left: 0;
	}
	.restrict {
		display: grid;
		gap: 2px;
		margin-top: 14px;
		font-size: 0.9rem;
	}
	.restrict label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 32rem) minmax(0, 1fr);
		gap: 22px;
		max-width: 76rem;
		margin: 0 auto;
		padding: 22px clamp(12px, 3vw, 40px) 60px;
		align-items: start;
	}
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
	}
	.summary .block {
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
	}
	.summary .block:last-child {
		border-bottom: none;
	}
	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 10px;
	}
	.summary h2,
	.picker h2 {
		margin: 0 0 6px;
		font-family: var(--font-body);
		font-size: 1.45rem;
		font-weight: 400;
		color: var(--bone);
	}
	.summary p,
	.detail p {
		margin: 2px 0;
		font-size: 0.92rem;
	}
	b {
		font-weight: 700;
	}
	.bank {
		font-size: 0.82rem;
		text-align: right;
		line-height: 1.3;
	}
	.dim {
		color: var(--bone-dim);
	}
	.summary a {
		color: var(--ember);
	}
	.warnings {
		margin: 12px 0 0;
		padding: 8px 14px 8px 28px;
		background: rgba(163, 23, 15, 0.25);
		border: 1px solid rgba(200, 35, 26, 0.6);
		font-size: 0.9rem;
	}
	.list {
		margin-top: 16px;
		background: var(--panel);
		border: 1px solid var(--line);
	}
	.band {
		margin: 0;
		padding: 9px 16px;
		background: #5c1a15;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: 1rem;
		font-weight: 700;
		border-bottom: 1px solid rgba(0, 0, 0, 0.3);
	}
	.row {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
		width: 100%;
		padding: 0 14px 0 0;
		background: transparent;
		color: var(--bone);
		border: none;
		border-bottom: 1px solid var(--line);
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1rem;
		cursor: pointer;
	}
	.row:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--bone);
		border-color: var(--line);
	}
	.row.on {
		background: #7a1d16;
	}
	.row.gone {
		opacity: 0.5;
	}
	.thumb {
		display: grid;
		place-items: center;
		width: 64px;
		height: 72px;
		background: rgba(0, 0, 0, 0.35);
		overflow: hidden;
		font-family: var(--font-display);
		color: var(--bone-dim);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 25%;
	}
	.what {
		display: grid;
		gap: 2px;
		padding: 8px 0;
		min-width: 0;
	}
	.what strong {
		font-size: 1.02rem;
	}
	.what small {
		color: var(--bone-dim);
	}
	.kit {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.86rem;
		color: #d8d0bd;
	}
	.cost {
		font-weight: 700;
		white-space: nowrap;
		font-variant-numeric: lining-nums;
	}
	.empty {
		margin-top: 16px;
		padding: 16px;
		color: var(--bone-dim);
	}
	.recruit {
		margin-top: 16px;
	}
	.action {
		background: #7a1d16;
		border-color: #7a1d16;
		color: var(--bone);
	}
	.action:hover {
		background: var(--blood-bright);
		border-color: var(--blood-bright);
	}
	.ghost {
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.3);
	}
	.ghost:hover {
		color: #fff;
		border-color: var(--ember);
	}
	.small,
	.mini {
		padding: 3px 10px;
		font-size: 0.72rem;
	}
	.mini {
		background: transparent;
		color: var(--bone-dim);
		border: 1px solid rgba(236, 229, 211, 0.2);
	}
	.mini:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--bone);
		border-color: var(--ember);
	}
	.picker {
		padding: 14px 16px;
	}
	.options {
		display: grid;
		max-height: 22rem;
		overflow-y: auto;
		border-top: 1px solid var(--line);
	}
	.option {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 10px;
		align-items: center;
		padding: 7px 4px;
		border-bottom: 1px solid var(--line);
		cursor: pointer;
	}
	.option span {
		display: grid;
	}
	.option small {
		color: var(--bone-dim);
	}
	.option.full {
		opacity: 0.45;
	}
	.picker .name {
		display: grid;
		gap: 3px;
		margin-top: 10px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-size: 0.9rem;
	}
	.buttons {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
	/* Detail: the chosen model. */
	.detail {
		position: sticky;
		top: 16px;
		padding: 14px 18px 18px;
	}
	.detail-head {
		display: grid;
		grid-template-columns: 1fr 140px;
		gap: 14px;
	}
	.picture {
		position: relative;
		display: grid;
		place-items: center;
		width: 140px;
		height: 160px;
		background: rgba(0, 0, 0, 0.35);
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 2.6rem;
		color: var(--bone-dim);
	}
	.picture img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 25%;
	}
	.pic {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 6px;
		padding: 3px 6px;
		background: rgba(21, 19, 14, 0.85);
		border: 1px solid rgba(236, 229, 211, 0.35);
		font-family: var(--font-body);
		font-size: 0.7rem;
		font-weight: 700;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--bone);
		cursor: pointer;
	}
	.pic input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 14px 0 4px;
	}
	.stats div {
		display: grid;
		gap: 3px;
	}
	.stats span {
		font-size: 0.72rem;
		font-weight: 700;
	}
	.stats strong {
		padding: 5px 10px;
		background: var(--panel-2);
		border: 1px solid var(--line);
		font-weight: 600;
		text-align: center;
		font-variant-numeric: lining-nums;
	}
	.detail h3 {
		margin: 18px 0 8px;
		padding: 0 0 4px;
		border-bottom: 1px solid var(--line);
		font-family: var(--font-body);
		font-size: 1.25rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.kitgroup {
		margin-bottom: 8px;
		background: var(--panel-2);
		border: 1px solid var(--line);
	}
	.kitgroup h4 {
		margin: 0;
		padding: 5px 10px;
		font-size: 0.82rem;
		border-bottom: 1px solid var(--line);
	}
	.kititem {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		padding: 6px 10px;
		border-bottom: 1px solid var(--line);
		font-weight: 600;
		font-size: 0.92rem;
	}
	.kititem:last-child {
		border-bottom: none;
	}
	.kititem .cost {
		margin-left: auto;
	}
	.kititem form {
		display: flex;
		gap: 4px;
		width: 100%;
	}
	.shop {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.shop select {
		flex: 1;
		min-width: 12rem;
	}
	.campaign {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 8px 12px;
	}
	.campaign label {
		display: grid;
		gap: 3px;
		font-size: 0.85rem;
	}
	.campaign .wide {
		grid-column: 1 / -1;
	}
	.campaign small {
		color: var(--bone-dim);
	}
	.campaign button {
		justify-self: start;
	}
	.detail input,
	.detail select,
	.detail textarea,
	.picker input {
		background: rgba(0, 0, 0, 0.35);
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.25);
	}
	.ability {
		margin: 6px 0;
		line-height: 1.5;
	}
	.dismiss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 20px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
		font-size: 0.85rem;
		color: var(--bone-dim);
	}
	.error {
		color: #ff9b8a;
	}
	@media (max-width: 60rem) {
		.layout {
			grid-template-columns: 1fr;
		}
		.detail {
			position: static;
			scroll-margin-top: 12px;
		}
	}
	@media (max-width: 30rem) {
		.stats {
			gap: 5px;
		}
		.stats strong {
			padding: 4px 6px;
			font-size: 0.88rem;
		}
		.detail-head {
			grid-template-columns: 1fr 110px;
		}
		.picture {
			width: 110px;
			height: 128px;
		}
	}
</style>
