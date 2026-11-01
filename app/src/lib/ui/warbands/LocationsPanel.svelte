<!--
  Locations the warband holds: each a name and a note (shown as bullets in the export), added and removed in place
  and saved together.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';

	type Props = { warband: ApiWarband; form: FormResult };
	let { warband: w, form }: Props = $props();
	const b = m.warbands.builder;
	const r = $derived(resultOf(form, 'locations'));
	// The page remounts this panel when the warband changes, so the rows start again from the saved locations.
	const fromSaved = () => w.locations.map((l) => ({ name: l.name, note: l.note ?? '' }));
	let rows = $state(fromSaved());
	const json = $derived(
		JSON.stringify(rows.map((l) => (l.note ? { name: l.name, note: l.note } : { name: l.name })))
	);
</script>

<section>
	<h3>{b.locations}</h3>
	{#if w.canEdit}
		<form
			method="POST"
			action="?/locations"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<input type="hidden" name="op" value="locations" />
			<input type="hidden" name="locations" value={json} />
			{#each rows as l, i (i)}
				<div class="loc">
					<Field
						label={b.locationName(i + 1)}
						name="locName{i}"
						maxlength={120}
						bind:value={l.name}
						error={r.fields[`locations.${i}.name`]}
					/>
					<TextArea label={b.locationNote(i + 1)} name="locNote{i}" rows={2} bind:value={l.note} />
					<button
						type="button"
						class="x"
						aria-label={b.removeLocation(i + 1)}
						title={b.removeLocation(i + 1)}
						onclick={() => rows.splice(i, 1)}><X size={16} aria-hidden={true} /></button
					>
				</div>
			{:else}
				<p class="dim">{b.locationsEmpty}</p>
			{/each}
			{#if r.error && !Object.keys(r.fields).length}<Message kind="danger">{r.error}</Message>{/if}
			{#if r.done}<Message>{b.saved}</Message>{/if}
			<div class="row">
				<Button icon={Plus} onclick={() => rows.push({ name: '', note: '' })}
					>{b.addLocation}</Button
				>
				<Button type="submit">{b.saveLocations}</Button>
			</div>
		</form>
	{:else if w.locations.length}
		<ul>
			{#each w.locations as l, i (i)}
				<li>
					<strong>{l.name}</strong>{#if l.note}<br /><span class="dim">{l.note}</span>{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="dim">{b.locationsEmpty}</p>
	{/if}
</section>

<style>
	section,
	form {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	.loc {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto;
		gap: var(--space-2);
		align-items: end;
	}
	.x {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		background: none;
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone);
		cursor: pointer;
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	ul {
		margin: 0;
		padding-left: var(--space-5);
	}
</style>
