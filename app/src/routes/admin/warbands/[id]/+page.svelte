<script lang="ts">
	import { enhance } from '$app/forms';
	import Portrait from '$lib/components/Portrait.svelte';
	import WarbandFields from '$lib/components/WarbandFields.svelte';
	import ModelStudio from '$lib/components/ModelStudio.svelte';
	import { FACTIONS } from '$lib/rules/factions';
	import { VISIONS, VISION_CVP } from '$lib/rules/visions';
	import { suggestedEntry } from '$lib/seating';

	let { data, form } = $props();

	const w = $derived(data.warband);
	const p = $derived(data.player);
	const houseZones = $derived(data.entryZones.some((z) => z.house));
	// svelte-ignore state_referenced_locally
	let visionCard = $state(data.warband.visionCard ?? '');
	const card = $derived(VISIONS.find((v) => v.id === visionCard));
	const factionName = $derived(FACTIONS.find((f) => f.id === w.faction)?.name ?? w.faction);
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<p><a href="/admin/warbands">← Warbands</a></p>

<div class="head">
	<Portrait name={p.name} portrait={p.portrait} symbol={w.symbol} faction={w.faction} size={88} />
	<div>
		<h1>{w.name}</h1>
		<div class="sub">{p.seat ? `P${p.seat} · ` : ''}{p.name} · {data.games} games played</div>
		<a class="roster-link" href="/warbands/{w.id}">Open the warband builder →</a>
		<a class="roster-link" href="/admin/warbands/{w.id}/roster">Bank, import and roster tools →</a>
	</div>
</div>

<section>
	<h2>Muster roll</h2>
	<form method="POST" action="?/update" enctype="multipart/form-data" use:enhance={keep}>
		<WarbandFields
			values={form?.values ?? {
				playerName: p.name,
				seat: p.seat,
				name: w.name,
				faction: w.faction,
				variant: w.variant,
				patron: w.patron,
				entryZone: w.entryZone ?? ''
			}}
			errors={form?.errors ?? {}}
			entryZones={data.entryZones}
			suggest={(seat) => suggestedEntry(seat, data.expectedPlayers, houseZones)}
		/>
		<div class="row">
			{#if p.portrait}<label class="check"><input type="checkbox" name="clearPortrait" /> Remove portrait</label>{/if}
			{#if w.symbol}<label class="check"><input type="checkbox" name="clearSymbol" /> Remove symbol</label>{/if}
		</div>
		<button>Save</button>
		{#if form?.saved}<span class="ok">Recorded.</span>{/if}
		{#if form?.message}<span class="error">{form.message}</span>{/if}
	</form>
</section>

<section>
	<h2>Account</h2>
	{#if data.account}
		<p class="note">
			{p.name} plays this warband as <strong>{data.account.username}</strong>{data.account.disabled ? ' (disabled)' : ''}, and can
			edit its seal, roster pictures and builder. Manage the account on <a href="/admin/players">Players</a>.
		</p>
	{:else}
		<p class="note">No account plays this warband yet. Create one for {p.name} on <a href="/admin/players">Players</a>.</p>
	{/if}
</section>

<section>
	<h2>Strongbox</h2>
	<p class="note">
		{w.treasuryDucats} Ducats and {w.treasuryGlory} Glory in the strongbox; the roster holds {data.spent} Ducats of models and battlekit.
	</p>
	{#if w.treasuryDucats <= 0}
		<form method="POST" action="?/strongbox" use:enhance={keep} class="inline">
			<button>Set the starting strongbox</button>
			<span class="note">700 Ducats, less the {data.spent} already spent: {700 - data.spent} Ducats.</span>
		</form>
	{/if}
	{#if form && 'strongbox' in form}<p class="ok">The strongbox now holds {form.strongbox} Ducats.</p>{/if}
</section>

<section>
	<h2>Map models</h2>
	<form method="POST" action="?/display" use:enhance={keep} class="inline">
		<label>
			Map marker
			<select name="displayModel" value={w.displayModel} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="portrait">Portrait disc</option>
				<option value="model">Figure token (portrait as a badge)</option>
			</select>
		</label>
		{#if form?.displaySaved}<span class="ok">Updated.</span>{/if}
	</form>
	<p class="note">
		Upload an STL of the warband's leader or its outpost; it is rendered once into a token for the map. Without
		one, the {factionName} default from <a href="/admin/factions">Factions</a> is used, then the stock token.
	</p>
	<ModelStudio
		kind="figure"
		ownerType="warband"
		ownerId={w.id}
		title="Figure"
		current={data.models.figure}
		fallback={data.models.factionFigure ? `the ${factionName} figure` : 'the portrait'}
	/>
	<ModelStudio
		kind="outpost"
		ownerType="warband"
		ownerId={w.id}
		title="Outpost"
		current={data.models.outpost}
		fallback={data.models.factionOutpost ? `the ${factionName} outpost` : 'the stock redoubt'}
	/>
</section>

<section class="secret">
	<h2>Patron Vision <small>secret until the reveal</small></h2>
	<form method="POST" action="?/vision" use:enhance={keep}>
		<label>
			Kept card
			<select name="visionCard" bind:value={visionCard}>
				<option value="">Not yet chosen</option>
				{#each VISIONS as v (v.id)}<option value={v.id}>{v.name}</option>{/each}
			</select>
		</label>
		{#if card}
			<ol class="levels">
				{#each card.levels as text, i (i)}
					<li class:met={(data.vision?.level ?? 0) > i}>{text} <small>· {VISION_CVP[i]} CVP</small></li>
				{/each}
			</ol>
			{#if card.metric}
				<p class="note">
					Tracked by the app: currently <strong>{data.vision?.metric ?? 0}</strong>
					(level {data.vision?.level ?? 0}).
				</p>
				<input type="hidden" name="visionProgress" value="0" />
			{:else}
				<label>
					Level achieved (set by the Campaign Master)
					<select name="visionProgress" value={String(w.visionProgress)}>
						{#each [0, 1, 2, 3] as l (l)}<option value={String(l)}>{l}</option>{/each}
					</select>
				</label>
			{/if}
		{/if}
		<label>
			Evidence (which model, where, when)
			<textarea name="visionNotes" rows="3">{w.visionNotes ?? ''}</textarea>
		</label>
		<button>Save Vision</button>
		{#if form?.visionSaved}<span class="ok">Sealed.</span>{/if}
	</form>
</section>

<section>
	<form method="POST" action="?/delete" use:enhance>
		<button class="danger" disabled={data.games > 0}>Remove warband</button>
		{#if data.games > 0}<small>Warbands with recorded games cannot be removed.</small>{/if}
	</form>
</section>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 18px;
	}
	h1 {
		margin: 0;
	}
	.sub {
		color: var(--muted);
	}
	.roster-link {
		display: block;
		font-variant-caps: small-caps;
		letter-spacing: 0.04em;
	}
	section {
		margin-top: 24px;
		padding: 16px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	h2 {
		margin-top: 0;
	}
	h2 small {
		font-family: var(--font-body);
		font-size: 0.5em;
		color: var(--blood);
		font-variant-caps: small-caps;
	}
	form {
		display: grid;
		gap: 14px;
		justify-items: start;
	}
	label {
		display: grid;
		gap: 4px;
	}
	.check {
		display: flex;
		gap: 6px;
	}
	.row {
		display: flex;
		gap: 16px;
	}
	textarea {
		width: min(36rem, 100%);
	}
	.secret {
		border-color: var(--blood);
	}
	.levels li.met {
		color: var(--supplies);
		font-weight: 600;
	}
	.note {
		margin: 0;
	}
	form.inline {
		margin-bottom: 8px;
	}
	.danger {
		background: var(--blood);
		border-color: var(--blood);
	}
	.danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
</style>
