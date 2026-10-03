<script lang="ts">
	/** One Patron in the Rules Editor: who may serve it, its text, and its Skills with their prices and limits. */
	import { enhance } from '$app/forms';
	import type { Patron } from '$lib/patrons';
	import ChipList from '$lib/components/ChipList.svelte';
	import LimitEditor from '$lib/components/LimitEditor.svelte';
	import PriceEditor from '$lib/components/PriceEditor.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import { describeLimit } from '$lib/warband-limits';

	let { p, errors, saved }: { p: Patron; errors: { path: string; message: string }[] | null; saved: boolean } = $props();

	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const k = () => Math.random();
	// Seeded once: the page keys this form by Patron.
	const P = (() => p)();
	let skills = $state(P.skills.map((s) => ({ ...structuredClone($state.snapshot(s)), key: k() })));
</script>

<form method="POST" action="?/save" use:enhance={keep} class="patron">
	<input type="hidden" name="id" value={P.id} />
	<fieldset class="grid">
		<legend>Patron</legend>
		<label class="wide">Name <input name="name" value={P.name} required /></label>
		<label>
			Alignment
			<select name="alignment" value={P.alignment ?? ''}><option value="">Either</option><option value="faithful">Faithful</option><option value="fallen">Fallen</option></select>
		</label>
		<label>Source <input name="source" value={P.source ?? ''} placeholder="Rulebook p. 123" /></label>
	</fieldset>

	<fieldset>
		<legend>Who may serve it</legend>
		<span class="lbl">Only these factions <small>(empty: any of its alignment)</small></span>
		<ChipList name="factions" kinds={['unit']} list="dl-faction" label="Only these factions" placeholder="Any faction…" values={P.factions} />
		<span class="lbl">Only these variants <small>(narrow only their own faction)</small></span>
		<ChipList name="variants" kinds={['unit']} list="dl-variant" label="Only these variants" placeholder="Any variant…" values={P.variants} />
	</fieldset>

	<label>Text <textarea name="text" rows="4">{P.text}</textarea></label>

	<fieldset>
		<legend>Skills</legend>
		<SortableList bind:items={skills} label="Skills" removable keyOf={(s) => s.key}>
			{#snippet row(s, i)}
				<div class="skill">
					<input name="sk_name" bind:value={s.name} placeholder="Skill name" aria-label="Skill {i + 1} name" />
					<textarea name="sk_text" bind:value={s.text} rows="2" placeholder="What it does" aria-label="Skill {i + 1} text"></textarea>
					<details open={!!(s.limits?.length || s.prices?.length)}>
						<summary>Rules and prices for models with it{s.limits?.length ? ` · ${s.limits.map((l) => l.text ?? describeLimit(l)).join(' ')}` : ''}</summary>
						<span class="lbl">Rules</span>
						<LimitEditor name="sk_limits" label="{s.name || `Skill ${i + 1}`} rules" scope="the models with it" value={s.limits ?? []} />
						<span class="lbl">Prices</span>
						<PriceEditor name="sk_prices" value={s.prices ?? []} />
					</details>
				</div>
			{/snippet}
		</SortableList>
		<button type="button" class="ghost" onclick={() => skills.push({ name: '', text: '', key: k() })}>+ Add a Skill</button>
	</fieldset>

	{#if errors?.length}
		<ul class="error" role="alert">{#each errors as e, i (i)}<li><code>{e.path.replace(/^patrons\[0\]\./, '')}</code> {e.message}</li>{/each}</ul>
	{/if}
	<div class="actions">
		<button>{P.id ? 'Save' : 'Add Patron'}</button>
		{#if saved}<span class="ok" role="status">Saved.</span>{/if}
	</div>
</form>

<style>
	.patron {
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
	.skill > input,
	.skill > textarea {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.lbl {
		font-size: 0.85rem;
	}
	.skill,
	details[open] {
		display: grid;
		gap: 5px;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--ink-soft);
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
