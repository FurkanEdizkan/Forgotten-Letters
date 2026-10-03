<script lang="ts">
	/** One Campaign Phase table in the Rules Editor: its die, text, and its results with what each does. */
	import { enhance } from '$app/forms';
	import type { CampaignTable } from '$lib/progression';
	import { DICE } from '$lib/progression';
	import SortableList from '$lib/components/SortableList.svelte';
	import EffectsFields from './EffectsFields.svelte';

	let { t, errors, saved }: { t: CampaignTable; errors: { path: string; message: string }[] | null; saved: boolean } = $props();

	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const k = () => Math.random();
	// Seeded once: the page keys this form by table.
	const T = (() => t)();
	let rows = $state(T.rows.map((r) => ({ ...structuredClone($state.snapshot(r)), key: k() })));
</script>

<form method="POST" action="?/table" use:enhance={keep} class="table">
	<input type="hidden" name="id" value={T.id} />
	<fieldset class="grid">
		<legend>Table</legend>
		<label class="wide">Name <input name="name" value={T.name} required /></label>
		{#if !T.id}<label>Id <input name="new_id" required pattern="[a-z0-9-]+" placeholder="my-table" /></label>{/if}
		<label>Die <select name="dice" value={T.dice}>{#each DICE as d (d)}<option value={d}>{d}</option>{/each}</select></label>
		<label>Source <input name="source" value={T.source ?? ''} /></label>
		<label class="wide">Text <textarea name="text" rows="3">{T.text}</textarea></label>
	</fieldset>

	<fieldset>
		<legend>Results <small>(every roll of the die once)</small></legend>
		<SortableList bind:items={rows} label="Results" removable keyOf={(r) => r.key}>
			{#snippet row(r, i)}
				<div class="result">
					<div class="head">
						<input name="r_roll" bind:value={r.roll} placeholder="2-3" aria-label="Result {i + 1} roll" />
						<input name="r_name" bind:value={r.name} placeholder="Name" aria-label="Result {i + 1} name" />
					</div>
					<textarea name="r_text" bind:value={r.text} rows="2" placeholder="What happens" aria-label="Result {i + 1} text"></textarea>
					<EffectsFields name="r_effects" value={r.effects} label={r.name || `Result ${i + 1}`} />
				</div>
			{/snippet}
		</SortableList>
		<button type="button" class="ghost" onclick={() => rows.push({ roll: '', name: '', text: '', key: k() })}>+ Add a result</button>
	</fieldset>

	{#if errors?.length}
		<ul class="error" role="alert">{#each errors as e, i (i)}<li><code>{e.path.replace(/^tables\[0\]\./, '')}</code> {e.message}</li>{/each}</ul>
	{/if}
	<div class="actions">
		<button>{T.id ? 'Save' : 'Add table'}</button>
		{#if saved}<span class="ok" role="status">Saved.</span>{/if}
	</div>
</form>

<style>
	.table {
		display: grid;
		gap: 12px;
	}
	fieldset {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 6px 12px 12px;
		border: 1px solid var(--rule);
	}
	legend {
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	small {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--muted);
	}
	.grid {
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	label {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
	}
	label > input,
	label > select,
	label > textarea,
	.result > textarea,
	.head > input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.result {
		display: grid;
		gap: 4px;
	}
	.head {
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: 4px;
	}
	button.ghost {
		justify-self: start;
	}
	.error {
		color: var(--blood);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
		position: sticky;
		bottom: 0;
		padding: 8px 0;
		background: var(--paper);
		border-top: 1px solid var(--rule);
	}
	.ok {
		color: var(--supplies);
	}
</style>
