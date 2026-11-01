<!--
  Fireteams: as many pairs as the faction allows, each two fighters on the table picked from lists, saved together.
  A fighter in two fireteams, or more fireteams than allowed, is refused with the engine's reason.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';

	type Props = { warband: ApiWarband; form: FormResult };
	let { warband: w, form }: Props = $props();
	const b = m.warbands.builder;
	const r = $derived(resultOf(form, 'fireteams'));
	const options = $derived([
		{ value: '', label: b.nobody },
		...w.fighters
			.filter((x) => x.group !== 'dead')
			.map((x) => ({ value: x.id, label: x.name ?? x.unitName }))
	]);
	const start = () =>
		Array.from({ length: w.fireteamsMax }, (_, i) => [...(w.fireteams[i] ?? ['', ''])]);
	// The page remounts this panel when the warband changes, so it starts again from the saved fireteams.
	let teams = $state(start());
	const json = $derived(JSON.stringify(teams.filter(([a, z]) => a && z)));
	const label = (id: string) => w.fighters.find((x) => x.id === id);
</script>

<section>
	<h3>{b.fireteams}</h3>
	{#if !w.fireteamsMax}
		<p class="dim">{b.fireteamsNone}</p>
	{:else if w.canEdit}
		<form
			method="POST"
			action="?/fireteams"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<input type="hidden" name="op" value="fireteams" />
			<input type="hidden" name="fireteams" value={json} />
			{#each teams as t, i (i)}
				<fieldset>
					<legend>{b.fireteam(i + 1)}</legend>
					<Select label="{b.fireteam(i + 1)} A" name="a{i}" {options} bind:value={t[0]} />
					<Select label="{b.fireteam(i + 1)} B" name="b{i}" {options} bind:value={t[1]} />
				</fieldset>
			{/each}
			{#if r.error}<Message kind="danger">{r.error}</Message>{/if}
			<div><Button type="submit">{b.saveFireteams}</Button></div>
		</form>
	{:else}
		<ul>
			{#each w.fireteams as t, i (i)}
				<li>
					{b.fireteam(i + 1)}: {t
						.map((id) => label(id)?.name ?? label(id)?.unitName ?? id)
						.join(', ')}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	section,
	form {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	fieldset {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: var(--space-1);
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	ul {
		margin: 0;
		padding-left: var(--space-5);
	}
</style>
