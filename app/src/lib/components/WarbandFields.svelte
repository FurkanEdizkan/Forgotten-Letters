<script lang="ts">
	import { FACTIONS, CF_PATRONS } from '$lib/rules/factions';
	import type { Zone } from '$lib/rules/types';

	interface Values {
		playerName?: string;
		seat?: number | null;
		name?: string;
		faction?: string;
		variant?: string | null;
		patron?: string | null;
		entryZone?: string;
	}

	let {
		values = {},
		errors = {},
		entryZones,
		suggest
	}: {
		values?: Values;
		errors?: Record<string, string | undefined>;
		entryZones: Zone[];
		suggest?: (seat: number) => string;
	} = $props();

	// Editable local copies of the incoming values (the form resets them on re-render).
	// svelte-ignore state_referenced_locally
	let faction = $state(values.faction ?? '');
	// svelte-ignore state_referenced_locally
	let entryZone = $state(values.entryZone ?? 'A');
	const variants = $derived(FACTIONS.find((f) => f.id === faction)?.variants ?? []);

	function onSeat(e: Event) {
		const seat = Number((e.currentTarget as HTMLInputElement).value);
		if (suggest && seat > 0) entryZone = suggest(seat);
	}
</script>

<div class="grid">
	<label>
		Player
		<input name="playerName" value={values.playerName ?? ''} required />
		{#if errors.playerName}<span class="error">{errors.playerName}</span>{/if}
	</label>
	<label>
		Seat (P#)
		<input name="seat" type="number" min="1" max="99" value={values.seat ?? ''} oninput={onSeat} />
	</label>
	<label class="wide">
		Warband name
		<input name="name" value={values.name ?? ''} required />
		{#if errors.name}<span class="error">{errors.name}</span>{/if}
	</label>
	<label>
		Faction
		<select name="faction" bind:value={faction} required>
			<option value="" disabled>Choose…</option>
			<optgroup label="Faithful">
				{#each FACTIONS.filter((f) => f.alignment === 'faithful') as f (f.id)}
					<option value={f.id}>{f.name}</option>
				{/each}
			</optgroup>
			<optgroup label="Fallen">
				{#each FACTIONS.filter((f) => f.alignment === 'fallen') as f (f.id)}
					<option value={f.id}>{f.name}</option>
				{/each}
			</optgroup>
		</select>
		{#if errors.faction}<span class="error">{errors.faction}</span>{/if}
	</label>
	<label>
		Variant
		<select name="variant" value={values.variant ?? ''} disabled={!variants.length}>
			<option value="">None</option>
			{#each variants as v (v)}<option value={v}>{v}</option>{/each}
		</select>
	</label>
	<label>
		Patron
		<input name="patron" list="patrons" value={values.patron ?? ''} />
		<datalist id="patrons">
			{#each CF_PATRONS as p (p.name)}<option value={p.name}>{p.restriction}</option>{/each}
		</datalist>
	</label>
	<label>
		Entry Zone
		<select name="entryZone" bind:value={entryZone}>
			{#each entryZones as z (z.id)}<option value={z.id}>{z.id} · {z.name}</option>{/each}
		</select>
		{#if errors.entryZone}<span class="error">{errors.entryZone}</span>{/if}
	</label>
	<label>
		Portrait
		<input name="portrait" type="file" accept="image/*" />
	</label>
	<label>
		Faction symbol
		<input name="symbol" type="file" accept="image/*" />
	</label>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 12px 16px;
	}
	label {
		display: grid;
		gap: 4px;
		align-content: start;
	}
	.wide {
		grid-column: span 2;
	}
	@media (max-width: 36rem) {
		.wide {
			grid-column: auto;
		}
	}
	input[type='file'] {
		border: none;
		background: none;
		padding: 0;
	}
	.error {
		color: var(--blood);
		font-size: 0.9em;
	}
</style>
