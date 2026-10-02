<script lang="ts">
	import { enhance } from '$app/forms';
	import Seal from '$lib/components/Seal.svelte';
	import { factionColours, sealLook } from '$lib/seals';
	import { patronAllowed } from '$lib/patrons';

	let { data, form } = $props();
	let pick = $state('');
	let busy = $state(false);
	const [factionId, variant] = $derived(pick.split('::'));
	// A Carcass Front list (picked under its faction) counts as chosen with that faction's card still showing.
	const subOf = (id: string) => data.factions.find((f) => f.subs.some((x) => x.id === id));
	const chosen = $derived(
		data.factions.find((f) => f.id === factionId) ??
			(subOf(factionId) ? { ...subOf(factionId)!.subs.find((x) => x.id === factionId)!, parent: subOf(factionId)! } : null)
	);
	const card = $derived(chosen ? ('parent' in chosen ? chosen.parent.id : chosen.id) : null);
	const rules = $derived(data.rulesFor[pick] ?? null);
	// The Patrons this pick may serve, and the one chosen (its rules and Skills shown beneath).
	const pickAlignment = $derived(chosen ? ('parent' in chosen ? chosen.parent.alignment : chosen.alignment) : null);
	const patrons = $derived(
		chosen
			? data.patrons.filter(
					(p) =>
						patronAllowed(p, { faction: factionId, variant: variant || null, alignment: pickAlignment as 'faithful' | 'fallen' }) &&
						(!rules?.patron || p.name.toLowerCase().startsWith(rules.patron.toLowerCase()))
				)
			: []
	);
	let patronName = $state('');
	const patron = $derived(patrons.find((p) => p.name === patronName) ?? null);
	$effect(() => {
		if (patronName && !patrons.some((p) => p.name === patronName)) patronName = '';
	});
	const alignment = (a: string) => (a === 'faithful' ? 'Faithful' : 'Fallen');
	let details = $state<HTMLElement>();
	let where = $state<'list' | 'campaign'>('list');
	// Starting money follows the variant's rules (Papal States: 500 Ducats and 11 Glory); only the CM may edit it.
	let ducats = $state(700);
	let glory = $state(0);
	$effect(() => {
		const m = data.rulesFor[pick];
		if (m) {
			ducats = m.ducats;
			glory = m.glory;
		}
	});

	function choose(value: string) {
		pick = value;
		// Bring the details into view once the faction is picked (the list is long on a phone).
		requestAnimationFrame(() => details?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
	}
</script>

<svelte:head><title>New Warband</title></svelte:head>

<div class="page tc">
	<div class="titlebar"><div class="inner"><h1>New Warband</h1></div></div>

	<details class="tc-start panel" open={!!(form && 'tcMessage' in form)}>
		<summary>Start from a Trench Companion warband</summary>
		<p class="hint">A share link, or the text or file from <em>Export Warband</em> (Full). It becomes a list of your own, with its faction, models, kit and fireteams matched to the books; you can use it for the campaign later.</p>
		<form method="POST" action="?/fromTc" enctype="multipart/form-data" use:enhance>
			<label>Link or number <input name="link" placeholder="https://trench-companion.com/warband/detail/…" /></label>
			<label>Or the exported text <textarea name="text" rows="4"></textarea></label>
			<label>Or the exported file <input type="file" name="file" accept=".txt,.json,text/plain,application/json" /></label>
			<button class="action">Import</button>
		</form>
		{#if form && 'tcMessage' in form}<p class="error" role="alert">{form.tcMessage}</p>{/if}
	</details>

	<form
		method="POST"
		action="?/create"
		class="inner"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<ol class="steps" aria-label="Steps">
			<li class:on={!chosen}>1 · Select Faction</li>
			<li class:on={!!chosen}>2 · Details</li>
		</ol>

		<fieldset class="factions" class:picked={!!chosen}>
			<legend>Select Faction</legend>
			{#each data.factions as f, i (f.id)}
				{@const c = factionColours(f.id)}
				{@const hasSeal = !!sealLook(f.id)}
				<div class="faction" class:hidden={chosen && card !== f.id} style:--low={c.low} style:--high={c.high} style:--metal={c.metal}>
					<label class="card" class:on={pick === `${f.id}::`}>
						<input type="radio" name="pick" value="{f.id}::" required checked={pick === `${f.id}::`} onchange={() => choose(`${f.id}::`)} />
						<span class="smoke" aria-hidden="true"></span>
						{#if f.cover}<img class="cover" src={f.cover} alt="" loading="lazy" />{/if}
						<span class="mark">
							{#if hasSeal}<Seal faction={f.id} size={104} phase={i / data.factions.length} />{:else}<span class="letter" aria-hidden="true">{f.name.replace(/^The /, '')[0]}</span>{/if}
						</span>
						<span class="name">
							<strong>{f.name}</strong>
							<small
								>{alignment(f.alignment)}{f.variants.length + f.subs.length
									? ` · ${f.variants.length + f.subs.length} variant${f.variants.length + f.subs.length > 1 ? 's' : ''}`
									: ''}</small
							>
						</span>
					</label>
					{#if f.variants.length || f.subs.length}
						<ul class="variants">
							{#each f.variants as v (v)}
								{@const value = `${f.id}::${v}`}
								<li class:hidden={chosen && pick !== value && (variant || factionId !== f.id)}>
									<label class="variant" class:on={pick === value}>
										<input type="radio" name="pick" {value} checked={pick === value} onchange={() => choose(value)} />
										{#if hasSeal}<Seal faction={f.id} size={34} />{/if}
										<span>{v}</span>
									</label>
								</li>
							{/each}
							<!-- Carcass Front's own lists: a sub-faction with its own variants. -->
							{#each f.subs as sub (sub.id)}
								{@const value = `${sub.id}::`}
								<li class:hidden={chosen && factionId !== sub.id && factionId !== f.id}>
									<label class="variant sub" class:on={pick === value}>
										<input type="radio" name="pick" {value} checked={pick === value} onchange={() => choose(value)} />
										{#if hasSeal}<Seal faction={sealLook(sub.id) ? sub.id : f.id} size={34} />{/if}
										<span>{sub.name}{#if sub.book}<small class="book">{sub.book}</small>{/if}</span>
									</label>
									{#if sub.variants.length}
										<ul class="variants nested">
											{#each sub.variants as v (v)}
												{@const sv = `${sub.id}::${v}`}
												<li class:hidden={chosen && pick !== sv && (variant || factionId !== sub.id)}>
													<label class="variant" class:on={pick === sv}>
														<input type="radio" name="pick" value={sv} checked={pick === sv} onchange={() => choose(sv)} />
														<span>{v}</span>
													</label>
												</li>
											{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
			{#if chosen}<button type="button" class="ghost change" onclick={() => (pick = '')}>Choose another faction</button>{/if}
		</fieldset>

		<section class="details panel" class:waiting={!chosen} bind:this={details} aria-labelledby="details-h">
			<h2 id="details-h">Details</h2>
			{#if chosen}<p class="for">{'parent' in chosen ? `${chosen.parent.name} — ` : ''}{chosen.name}{variant ? ` — ${variant}` : ''}</p>{/if}
			{#if rules}
				<!-- What this faction or variant brings, before it is founded. -->
				<section class="pick-rules" aria-label="Special rules">
					<p class="starts">
						Starts with <strong>{rules.ducats} Ducats</strong>{#if rules.glory} and <strong>{rules.glory} Glory</strong>{/if}{#if rules.leader} · Leader: <strong>{rules.leader}</strong>{/if}
					</p>
					<ul class="facts">
						{#if rules.mustInclude.length}<li><b>Must include</b> {rules.mustInclude.map((m) => (m.n > 1 ? `${m.n} ${m.name}` : m.name)).join(', ')}</li>{/if}
						{#if rules.excluded.length}<li><b>Cannot include</b> {rules.excluded.join(', ')}</li>{/if}
						{#if rules.caps.length}<li><b>At most</b> {rules.caps.map((c) => `${c.max} ${c.name}`).join(', ')}</li>{/if}
						{#if rules.upgrades.length}
							<li>
								<b>Upgrades</b>
								{rules.upgrades
									.map((u) => `${u.name}${u.cost ? ` (${u.cost} ${u.currency === 'glory' ? 'Glory' : 'Ducats'})` : ''}${u.max != null ? `, up to ${u.max}` : ''}${u.for.length ? `, for ${u.for.join(' or ')}` : ''}`)
									.join(' · ')}
							</li>
						{/if}
					</ul>
					{#if rules.variant.length}
						<h3>{variant} rules</h3>
						<dl class="rules-list">
							{#each rules.variant as r, i (i)}{#if r.name}<dt>{r.name}</dt>{/if}<dd>{r.text}</dd>{/each}
						</dl>
					{/if}
					{#if rules.faction.length}
						<details open={!variant}>
							<summary>{chosen?.name} rules</summary>
							<dl class="rules-list">
								{#each rules.faction as r, i (i)}{#if r.name}<dt>{r.name}</dt>{/if}<dd>{r.text}</dd>{/each}
							</dl>
						</details>
					{/if}
				</section>
			{/if}

			{#if chosen && patrons.length}
				<label>
					Patron
					<select name="patron" bind:value={patronName}>
						<option value="">None (choose later)</option>
						{#each patrons as p (p.id)}<option value={p.name}>{p.name}</option>{/each}
					</select>
					<small>The power your warband serves. Its Skills can be taken as your models gain experience.</small>
				</label>
				{#if patron}
					<section class="pick-rules" aria-label="Patron">
						{#if patron.text}<p class="starts">{patron.text}</p>{/if}
						<dl class="rules-list">
							{#each patron.skills as k (k.name)}<dt>{k.name}</dt><dd>{k.text}</dd>{/each}
						</dl>
						{#if patron.source}<small class="book">{patron.source}</small>{/if}
					</section>
				{/if}
			{/if}

			<label>
				Warband Name
				<input name="name" required maxlength="80" placeholder="Your warband's name" autocomplete="off" />
				<small>You can change the name of your warband at any time.</small>
			</label>

			{#if data.canFound}
				<fieldset class="where">
					<legend>For</legend>
					<label><input type="radio" name="where" value="list" bind:group={where} /> <span><strong>My warband lists</strong><small>Build freely; use it for the campaign when you're ready.</small></span></label>
					<label><input type="radio" name="where" value="campaign" bind:group={where} /> <span><strong>The Carcass Front campaign</strong><small>{data.players.length ? 'Found a campaign warband for a player.' : 'Found your campaign warband now.'}</small></span></label>
				</fieldset>
			{:else}
				<input type="hidden" name="where" value="list" />
			{/if}

			{#if where === 'campaign'}
				{#if data.entryLocked}
					<p class="entry-fixed">
						Comes ashore at <strong>{data.entryZones.find((z) => z.id === data.suggestedEntry)?.name ?? `Entry Zone ${data.suggestedEntry ?? ''}`}</strong>,
						your seat's Entry Zone. Only the Campaign Master can move it.
					</p>
				{:else}
				<label>
					Entry Zone
					<select name="entryZone" required value={data.suggestedEntry ?? ''}>
						<option value="">Where the warband comes ashore…</option>
						{#each data.entryZones as z (z.id)}<option value={z.id}>{z.name}{z.id === data.suggestedEntry ? ' (your seat)' : ''}</option>{/each}
					</select>
				</label>
				{/if}
			{/if}

			<div class="money">
				<!-- The book's starting money; only the Campaign Master may change it. -->
				<label>Starting Ducats <input name="ducats" type="number" min="0" max="100000" bind:value={ducats} inputmode="numeric" readonly={!data.isAdmin} /></label>
				<label>Starting Glory <input name="glory" type="number" min="0" max="100000" bind:value={glory} inputmode="numeric" readonly={!data.isAdmin} /></label>
			</div>

			<label class="toggle">
				<input type="checkbox" name="required" checked />
				<span>
					<strong>Recruit the required models now</strong>
					<small>{rules?.leader || rules?.mustInclude.length ? `${[...new Set([rules.leader, ...rules.mustInclude.map((m) => (m.n > 1 ? `${m.n} × ${m.name}` : m.name))].filter(Boolean))].join(', ')}, paid from the starting money.` : 'The models this pick must include, paid from the starting money.'}</small>
				</span>
			</label>

			{#if data.isAdmin}
				<!-- The books' rules always apply; only the Campaign Master may lift them. -->
				<label class="toggle">
					<input type="checkbox" name="unrestricted" />
					<span>
						<strong>Remove Restrictions</strong>
						<small>Campaign Master only. The builder then does not check the books' rules: numbers, costs, battlekit and the rest.</small>
					</span>
				</label>
			{/if}

			{#if data.players.length && where === 'campaign'}
					<label>
						For player
						<select name="for">
							<option value="">A seat without an account…</option>
							{#each data.players as p (p.id)}<option value={p.id} disabled={p.hasWarband}>{p.displayName || p.username}{p.hasWarband ? ' (has a warband)' : ''}</option>{/each}
						</select>
					</label>
					<label>Player name <small>(only for a seat without an account)</small> <input name="playerName" maxlength="60" /></label>
			{/if}

			{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
			<button class="action" disabled={busy}>{busy ? 'Founding…' : 'Create Warband'}</button>
		</section>
	</form>
</div>

<style>
	.page {
		--panel: rgba(38, 35, 30, 0.94);
		--line: rgba(236, 229, 211, 0.12);
		min-height: 100vh;
		background: radial-gradient(circle at 70% 20%, #2a261d, var(--night) 70%);
		color: var(--bone);
		padding-bottom: 48px;
	}
	.titlebar {
		background: #6b1a14;
		border-bottom: 1px solid rgba(0, 0, 0, 0.4);
	}
	.inner {
		max-width: 60rem;
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
	.steps {
		display: flex;
		gap: 22px;
		list-style: none;
		padding: 8px 0 4px;
		margin: 0;
		font-size: 0.85rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(236, 229, 211, 0.45);
	}
	.steps .on {
		color: var(--bone);
		border-bottom: 2px solid #b3261e;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 14px;
	}
	legend {
		font-family: var(--font-title);
		font-size: 1.6rem;
		color: var(--bone);
		margin: 14px 0 10px;
		padding: 0;
	}
	.hidden {
		display: none;
	}
	input[type='radio'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 20px;
		min-height: 132px;
		padding: 14px 20px;
		overflow: hidden;
		isolation: isolate;
		background: #1c1914;
		border: 1px solid var(--line);
		cursor: pointer;
		transition:
			border-color 0.2s var(--ease-out),
			transform 0.2s var(--ease-out);
	}
	/* Smoke lit from below in the faction's own light. */
	.smoke {
		position: absolute;
		inset: 0;
		z-index: -2;
		background:
			radial-gradient(ellipse 60% 120% at 12% 110%, color-mix(in oklab, var(--low) 55%, transparent), transparent 70%),
			radial-gradient(ellipse 40% 80% at 18% 0%, color-mix(in oklab, var(--high) 18%, transparent), transparent 70%);
		opacity: 0.55;
		transition: opacity 0.3s var(--ease-out);
	}
	.cover {
		position: absolute;
		inset: 0 0 0 auto;
		width: 58%;
		height: 100%;
		object-fit: cover;
		z-index: -1;
		mask-image: linear-gradient(to right, transparent, #000 45%);
		opacity: 0.8;
	}
	.card:hover,
	.card:has(input:focus-visible),
	.card.on {
		border-color: color-mix(in oklab, var(--high) 60%, transparent);
	}
	.card:hover .smoke,
	.card.on .smoke {
		opacity: 1;
	}
	.card:has(input:focus-visible) {
		outline: 2px solid var(--bone);
		outline-offset: 2px;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 104px;
		height: 104px;
		flex: none;
	}
	.letter {
		display: grid;
		place-items: center;
		width: 88px;
		height: 88px;
		border-radius: 50%;
		border: 2px solid var(--metal);
		font-family: var(--font-title);
		font-size: 3rem;
		color: var(--metal);
		box-shadow: 0 0 28px color-mix(in oklab, var(--low) 60%, transparent) inset;
	}
	.name {
		display: grid;
		gap: 2px;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.8);
	}
	.name strong {
		font-family: var(--font-title);
		font-weight: 400;
		font-size: clamp(1.4rem, 3.4vw, 2.1rem);
		line-height: 1.05;
	}
	.name small {
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(236, 229, 211, 0.65);
	}
	.variants {
		list-style: none;
		margin: 0;
		padding: 0 0 0 clamp(24px, 8vw, 72px);
		display: grid;
	}
	.variant {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 7px 14px;
		border: 1px solid var(--line);
		border-top: 0;
		background: rgba(28, 25, 20, 0.92);
		cursor: pointer;
	}
	.variant:hover,
	.variant.on {
		background: #2b2620;
		border-left: 3px solid var(--high);
	}
	.variant:has(input:focus-visible) {
		outline: 2px solid var(--bone);
		outline-offset: -2px;
	}
	.change {
		justify-self: start;
	}
	/* Starting from Trench Companion: a fold above the two steps, for those who already have a list there. */
	.tc-start {
		max-width: 60rem;
		margin: 18px auto 0;
	}
	.tc-start summary {
		cursor: pointer;
		font-weight: 600;
	}
	.tc-start form {
		display: grid;
		gap: 8px;
	}
	.tc-start label {
		display: grid;
		gap: 3px;
	}
	.tc-start form .action {
		justify-self: start;
	}
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		padding: 18px 20px 22px;
		margin-top: 18px;
		display: grid;
		gap: 14px;
		scroll-margin-top: 16px;
	}
	.details h2 {
		margin: 0;
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 1.6rem;
		color: var(--bone);
	}
	.details.waiting {
		opacity: 0.55;
	}
	.for {
		margin: -8px 0 0;
		color: rgba(236, 229, 211, 0.7);
	}
	/* A Carcass Front list under its faction: its own row, marked with its book, with its variants beneath. */
	.variant.sub span {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.book {
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(236, 229, 211, 0.55);
	}
	.variants.nested {
		padding-left: clamp(18px, 5vw, 40px);
	}
	/* The picked faction's or variant's rules: what it starts with and must or cannot field, then its rules. */
	.pick-rules {
		display: grid;
		gap: 8px;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-left: 3px solid var(--high, var(--blood-bright));
		background: rgba(20, 18, 14, 0.6);
	}
	.pick-rules .starts {
		margin: 0;
	}
	.facts {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 4px;
		font-size: 0.95rem;
	}
	.facts b {
		margin-right: 4px;
		color: var(--bone);
	}
	.pick-rules h3,
	.pick-rules summary {
		margin: 6px 0 0;
		font-size: 1rem;
		font-weight: 600;
		cursor: default;
	}
	.pick-rules summary {
		cursor: pointer;
	}
	.rules-list {
		margin: 4px 0 0;
		display: grid;
		gap: 2px;
		max-height: 22rem;
		overflow-y: auto;
		font-size: 0.93rem;
		line-height: 1.45;
	}
	.rules-list dt {
		margin-top: 6px;
		font-weight: 600;
		color: var(--bone);
	}
	.rules-list dd {
		margin: 0;
		color: rgba(236, 229, 211, 0.8);
	}
	.details label {
		display: grid;
		gap: 4px;
	}
	.details small {
		color: rgba(236, 229, 211, 0.6);
	}
	.details input:not([type='checkbox']),
	.details select {
		background: #14120e;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.25);
		padding: 8px 10px;
		font: inherit;
	}
	.where {
		display: grid;
		gap: 6px;
		border: 0;
		margin: 0;
		padding: 0;
	}
	.where legend {
		margin-bottom: 4px;
	}
	.where label {
		display: flex !important;
		gap: 10px;
		align-items: flex-start;
		padding: 8px 10px;
		border: 1px solid var(--line);
		cursor: pointer;
	}
	.where label:has(input:checked) {
		border-color: #b3261e;
		background: rgba(143, 31, 24, 0.25);
	}
	.where span {
		display: grid;
	}
	.money {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.toggle {
		display: flex !important;
		align-items: flex-start;
		gap: 10px;
	}
	.toggle input {
		margin-top: 4px;
		width: 18px;
		height: 18px;
		accent-color: #b3261e;
	}
	.toggle span {
		display: grid;
		gap: 2px;
	}
	.action {
		justify-self: start;
		background: #8f1f18;
		color: var(--bone);
		border: 1px solid #b3261e;
		padding: 9px 22px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.action:disabled {
		opacity: 0.6;
	}
	.ghost {
		background: transparent;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.3);
		padding: 6px 14px;
		font: inherit;
		cursor: pointer;
	}
	.error {
		color: #ff9b8f;
		margin: 0;
	}
	@media (max-width: 560px) {
		.card {
			min-height: 104px;
			gap: 12px;
			padding: 10px 12px;
		}
		.mark {
			width: 76px;
			height: 76px;
		}
		.mark :global(.seal) {
			--size: 76px !important;
		}
		.letter {
			width: 66px;
			height: 66px;
			font-size: 2.2rem;
		}
		.money {
			grid-template-columns: 1fr;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card,
		.smoke {
			transition: none;
		}
	}
</style>
