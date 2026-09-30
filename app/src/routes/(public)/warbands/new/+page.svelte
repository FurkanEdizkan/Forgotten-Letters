<script lang="ts">
	import { enhance } from '$app/forms';
	import Seal from '$lib/components/Seal.svelte';
	import { factionColours, sealLook } from '$lib/seals';

	let { data, form } = $props();
	let pick = $state('');
	let busy = $state(false);
	const [factionId, variant] = $derived(pick.split('::'));
	const chosen = $derived(data.factions.find((f) => f.id === factionId) ?? null);
	const alignment = (a: string) => (a === 'faithful' ? 'Faithful' : 'Fallen');
	let details = $state<HTMLElement>();
	let where = $state<'list' | 'campaign'>('list');
	// Starting money follows the variant's rules (Papal States: 500 Ducats and 11 Glory); the fields stay editable.
	let ducats = $state(700);
	let glory = $state(0);
	$effect(() => {
		const m = data.startMoney[pick];
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

	<form
		method="POST"
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
				<div class="faction" class:hidden={chosen && chosen.id !== f.id} style:--low={c.low} style:--high={c.high} style:--metal={c.metal}>
					<label class="card" class:on={pick === `${f.id}::`}>
						<input type="radio" name="pick" value="{f.id}::" required checked={pick === `${f.id}::`} onchange={() => choose(`${f.id}::`)} />
						<span class="smoke" aria-hidden="true"></span>
						{#if f.cover}<img class="cover" src={f.cover} alt="" loading="lazy" />{/if}
						<span class="mark">
							{#if hasSeal}<Seal faction={f.id} size={104} phase={i / data.factions.length} />{:else}<span class="letter" aria-hidden="true">{f.name.replace(/^The /, '')[0]}</span>{/if}
						</span>
						<span class="name">
							<strong>{f.name}</strong>
							<small>{alignment(f.alignment)}{f.variants.length ? ` · ${f.variants.length} variant${f.variants.length > 1 ? 's' : ''}` : ''}</small>
						</span>
					</label>
					{#if f.variants.length}
						<ul class="variants">
							{#each f.variants as v (v)}
								{@const value = `${f.id}::${v}`}
								<li class:hidden={chosen && pick !== value && variant}>
									<label class="variant" class:on={pick === value}>
										<input type="radio" name="pick" {value} checked={pick === value} onchange={() => choose(value)} />
										{#if hasSeal}<Seal faction={f.id} size={34} />{/if}
										<span>{v}</span>
									</label>
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
			{#if chosen}<p class="for">{chosen.name}{variant ? ` — ${variant}` : ''}</p>{/if}

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
				<label>
					Entry Zone
					<select name="entryZone" required value={data.suggestedEntry ?? ''}>
						<option value="">Where the warband comes ashore…</option>
						{#each data.entryZones as z (z.id)}<option value={z.id}>{z.name}{z.id === data.suggestedEntry ? ' (your seat)' : ''}</option>{/each}
					</select>
				</label>
			{/if}

			<div class="money">
				<label>Starting Ducats <input name="ducats" type="number" min="0" max="100000" bind:value={ducats} inputmode="numeric" /></label>
				<label>Starting Glory <input name="glory" type="number" min="0" max="100000" bind:value={glory} inputmode="numeric" /></label>
			</div>

			<label class="toggle">
				<input type="checkbox" name="unrestricted" />
				<span>
					<strong>Remove Restrictions</strong>
					<small>If restrictions are removed, the builder will not check limits on the number of models, their cost, and the battlekit they can carry.</small>
				</span>
			</label>

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
