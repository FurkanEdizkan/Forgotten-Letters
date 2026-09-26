<script lang="ts">
	import { enhance } from '$app/forms';
	import Portrait from '$lib/components/Portrait.svelte';
	import WarbandFields from '$lib/components/WarbandFields.svelte';
	import { VISIONS, VISION_CVP } from '$lib/rules/visions';
	import { suggestedEntry } from '$lib/seating';

	let { data, form } = $props();

	const w = $derived(data.warband);
	const p = $derived(data.player);
	const houseZones = $derived(data.entryZones.some((z) => z.house));
	// svelte-ignore state_referenced_locally
	let visionCard = $state(data.warband.visionCard ?? '');
	const card = $derived(VISIONS.find((v) => v.id === visionCard));
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<p><a href="/admin/warbands">← Warbands</a></p>

<div class="head">
	<Portrait name={p.name} portrait={p.portrait} symbol={w.symbol} size={88} />
	<div>
		<h1>{w.name}</h1>
		<div class="sub">{p.seat ? `P${p.seat} · ` : ''}{p.name} · {data.games} games played</div>
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
				entryZone: w.entryZone
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
