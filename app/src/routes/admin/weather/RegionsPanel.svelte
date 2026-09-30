<script lang="ts">
	import { enhance } from '$app/forms';
	import Mark from '$lib/components/Mark.svelte';
	import { AMBIENT_KINDS, FX_LABELS, type FxKind, type FxLayer } from '$lib/fx/types';
	import { WEATHER, weatherByRoll } from '$lib/rules/weather';
	import type { Zone } from '$lib/rules/types';

	interface Region {
		id: string;
		name: string | null;
		zones: string[] | null;
		weatherEvent: number | null;
		gamesRemaining: number | null;
		active: boolean;
		layers: Partial<Record<FxKind, FxLayer>>;
	}

	/**
	 * Weather over part of the front. The regions in force come first; a new one is composed below, its zones picked
	 * from the groups, the list, or by clicking them on the preview map (`picking` tells the page to route clicks here).
	 */
	let {
		regions,
		zones,
		form,
		picked = $bindable(),
		picking = $bindable()
	}: { regions: Region[]; zones: Zone[]; form: Record<string, unknown> | null; picked: string[]; picking: boolean } = $props();

	const GROUPS: Record<string, string[]> = {
		'The coast': ['E', 'B', 'amoudet-seawall', 'altar-of-leviathan', 'carrion-coast', 'pillar-of-jonah', 'sword-of-god', 'risen-ruins'],
		'The Amanus front': ['north-amanus-trenches', 'south-amanus-trenches', 'holy-choked-path', 'desolate-trapesac', 'syrian-gate'],
		'The east': ['kurd-dagh', 'kyrrhos-city', 'stylite-row', 'basarfuth-castle', 'ruins-of-nineveh-novus', 'scavenger-town', 'F']
	};
	const known = $derived(new Set(zones.map((z) => z.id)));
	const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;

	let event = $state('');
	let wholeMap = $state(false);
	let kinds = $state<Partial<Record<FxKind, number>>>({});
	const layers = $derived(Object.fromEntries(Object.entries(kinds).map(([k, intensity]) => [k, { on: true, intensity, speed: 1, scale: 1, opacity: 1, tint: null }])));
	const chosenEvent = $derived(event ? weatherByRoll(Number(event)) : undefined);

	function toggleKind(k: FxKind) {
		if (k in kinds) delete kinds[k];
		else kinds[k] = 0.7;
	}
	function addGroup(ids: string[]) {
		picked = [...new Set([...picked, ...ids.filter((id) => known.has(id))])];
	}
	function reset() {
		picking = false;
		picked = [];
		kinds = {};
		event = '';
		wholeMap = false;
	}
	const describe = (r: Region) => {
		const w = r.weatherEvent ? weatherByRoll(r.weatherEvent) : null;
		const running = AMBIENT_KINDS.filter((k) => r.layers[k]?.on).map((k) => FX_LABELS[k]);
		return { w, running };
	};
</script>

<div class="stack">
	<section class="card" aria-labelledby="in-force">
		<h3 id="in-force">In force</h3>
		{#if regions.length}
			<ul class="regions">
				{#each regions as r (r.id)}
					{@const d = describe(r)}
					<li class:lifted={!r.active}>
						<div class="what">
							<strong>{r.name ?? d.w?.name ?? d.running.join(', ')}</strong>
							{#if !r.active}<span class="tag">lifted</span>{/if}
							<small>
								{r.zones ? r.zones.map(zoneName).join(', ') : 'The whole map'}
								{#if d.w && r.name} · {d.w.name}{/if}
								{#if d.running.length} · {d.running.join(', ')}{/if}
								{#if r.gamesRemaining !== null} · {r.gamesRemaining} game{r.gamesRemaining === 1 ? '' : 's'} left{/if}
							</small>
						</div>
						<div class="acts">
							<form method="POST" action="?/toggleRegion" use:enhance>
								<input type="hidden" name="id" value={r.id} />
								<button class="ghost small">{r.active ? 'Lift' : 'Restore'}</button>
							</form>
							<form method="POST" action="?/deleteRegion" use:enhance>
								<input type="hidden" name="id" value={r.id} />
								<button class="ghost small danger">Delete</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">No regional weather. The whole front shares the sky from the Sky tab.</p>
		{/if}
	</section>

	<form
		method="POST"
		action="?/addRegion"
		class="card"
		use:enhance={() =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') reset();
			}}
	>
		<h3>New region</h3>
		<div class="grid3">
			<label>Name <input name="name" placeholder="e.g. The Red Tide" /></label>
			<label>
				Hell on Earth event
				<select name="weatherEvent" bind:value={event}>
					<option value="">None</option>
					{#each WEATHER as w (w.roll)}<option value={String(w.roll)}>{w.roll} · {w.name}</option>{/each}
				</select>
			</label>
			<label>Lasts <input name="gamesRemaining" type="number" min="1" placeholder="until lifted" /> <small class="hint">games played in the region</small></label>
		</div>
		{#if chosenEvent}<p class="effect"><strong>{chosenEvent.name}.</strong> {chosenEvent.effect}</p>{/if}

		<fieldset>
			<legend>Its weather</legend>
			<div class="tiles">
				{#each AMBIENT_KINDS as k (k)}
					<button type="button" class="tile" aria-pressed={k in kinds} onclick={() => toggleKind(k)}>{FX_LABELS[k]}</button>
				{/each}
			</div>
			{#if Object.keys(kinds).length}
				<ul class="strengths">
					{#each Object.keys(kinds) as k (k)}
						<li class="line">
							<span class="name">{FX_LABELS[k as FxKind]}</span>
							<input type="range" min="0.1" max="1" step="0.05" bind:value={kinds[k as FxKind]} aria-label="{FX_LABELS[k as FxKind]} strength" />
							<span class="val">{Math.round((kinds[k as FxKind] ?? 0) * 100)}%</span>
						</li>
					{/each}
				</ul>
			{/if}
		</fieldset>
		<input type="hidden" name="layers" value={JSON.stringify(layers)} />

		<fieldset>
			<legend>Where</legend>
			<label class="switch"><input type="checkbox" role="switch" name="wholeMap" bind:checked={wholeMap} /> <span>The whole map</span></label>
			{#if !wholeMap}
				<div class="inline">
					{#each Object.entries(GROUPS) as [name, ids] (name)}
						<button type="button" class="ghost small" onclick={() => addGroup(ids)}>+ {name}</button>
					{/each}
					<select aria-label="Add a zone" onchange={(e) => { const v = e.currentTarget.value; if (v) addGroup([v]); e.currentTarget.value = ''; }}>
						<option value="">Add a zone…</option>
						{#each zones.filter((z) => !picked.includes(z.id)) as z (z.id)}<option value={z.id}>{z.name}</option>{/each}
					</select>
				</div>
				<label class="switch pick">
					<input type="checkbox" role="switch" bind:checked={picking} />
					<span>{picking ? 'Clicking zones on the map adds or removes them' : 'Pick zones on the map'}</span>
				</label>
				{#if picked.length}
					<ul class="chips">
						{#each picked as id (id)}
							<li>
								<input type="hidden" name="zones" value={id} />
								{zoneName(id)}
								<button type="button" class="icon" aria-label="Remove {zoneName(id)}" onclick={() => (picked = picked.filter((z) => z !== id))}><Mark name="close" /></button>
							</li>
						{/each}
						<li><button type="button" class="link" onclick={() => (picked = [])}>Clear all</button></li>
					</ul>
				{:else}
					<p class="hint">No zones yet.</p>
				{/if}
			{/if}
		</fieldset>

		<div class="inline">
			<button>Set the weather</button>
			{#if form && 'regionMessage' in form}<span class="error" role="alert">{form.regionMessage}</span>{/if}
		</div>
	</form>
</div>

<style>
	h3 {
		margin: 0 0 8px;
		font-size: 1.2rem;
	}
	.regions {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 2px solid var(--ink);
	}
	.regions li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 14px;
		padding: 8px 0;
		border-bottom: 1px solid var(--rule);
	}
	.regions li.lifted .what {
		opacity: 0.55;
	}
	.what {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.what small {
		color: var(--ink-soft);
	}
	.tag {
		justify-self: start;
		padding: 0 6px;
		border: 1px solid var(--rule);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.acts {
		display: flex;
		gap: 6px;
	}
	.grid3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 10px 14px;
	}
	.grid3 label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	.effect {
		margin: 8px 0 0;
		padding: 6px 10px;
		border-left: 2px solid var(--blood);
		background: var(--paper);
	}
	fieldset {
		margin: 12px 0 0;
	}
	.strengths {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.name {
		min-width: 8.5rem;
		font-weight: 600;
	}
	.pick {
		margin-top: 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.chips li {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 2px 2px 10px;
		background: var(--paper);
		border: 1px solid var(--ink);
	}
	.chips li:last-child {
		border: 0;
		background: none;
	}
	.error {
		color: var(--blood);
	}
</style>
