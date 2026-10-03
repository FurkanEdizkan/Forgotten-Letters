<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { DICE } from '$lib/progression';
	import TableForm from './TableForm.svelte';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const ORIGIN: Record<string, string> = { custom: 'yours', edited: 'house rule', book: '' };
	const blank = { id: '', name: '', dice: 'D6' as const, source: null, text: '', rows: [] };
	const isProgression = $derived(data.entry === 'progression');
	const sel = $derived(data.entry === 'new' || isProgression ? null : (data.tables.find((t) => t.id === data.entry) ?? data.tables[0] ?? null));
	const errorsAt = (at: string) => (form && 'errors' in form && form.at === at ? form.errors : null);
	const saved = (id: string | undefined) => !!(form && 'saved' in form && form.saved === id);
	const pr = $derived(data.progression?.settings);
	// A new table, once saved, becomes the one open.
	$effect(() => {
		if (data.entry === 'new' && form && 'saved' in form && data.tables.some((t) => t.id === form.saved)) goto(`?entry=${encodeURIComponent(String(form.saved))}`, { replaceState: true, noScroll: true });
	});
</script>

<svelte:head><title>Campaign Phase · Faction Studio</title></svelte:head>

<datalist id="dl-keyword">{#each data.keywordNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-unit">{#each data.unitNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-item">{#each data.itemNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-skill">{#each data.skillNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-upgrade"></datalist>

<p class="crumb"><a href="/admin/studio">Faction Studio</a> · edition <a href="/admin/studio/editions">{data.edition}</a></p>
<h1>Campaign Phase</h1>

<div class="workbench">
	<nav class="entries" aria-label="Campaign tables">
		<ul>
			<li class:on={isProgression}>
				<a href="?entry=progression" aria-current={isProgression ? 'true' : undefined} data-sveltekit-noscroll>Experience and Promotion</a>
				{#if data.progression && ORIGIN[data.progression.origin]}<span class="tick">{ORIGIN[data.progression.origin]}</span>{/if}
			</li>
			{#each data.tables as t (t.id)}
				<li class:on={sel?.id === t.id}>
					<a href="?entry={encodeURIComponent(t.id)}" aria-current={sel?.id === t.id ? 'true' : undefined} data-sveltekit-noscroll>{t.name}</a>
					<span class="meta">{t.dice} · {t.rows.length} results</span>
					{#if ORIGIN[t.origin]}<span class="tick">{ORIGIN[t.origin]}</span>{/if}
				</li>
			{:else}<li class="meta">No tables in this edition yet.</li>{/each}
		</ul>
		<a class="add" href="?entry=new" aria-current={data.entry === 'new' ? 'true' : undefined} data-sveltekit-noscroll>+ New table</a>
	</nav>

	<section class="pane" aria-label={isProgression ? 'Experience and Promotion' : (sel?.name ?? 'New table')}>
		{#if isProgression}
			<form method="POST" action="?/progression" use:enhance={keep} class="prog">
				<fieldset class="grid">
					<legend>Experience and Promotion</legend>
					<label class="wide">Advancement Roll at these Experience totals <input name="advancement_at" value={pr?.advancementAt.join(', ') ?? ''} placeholder="2, 4, 7, 10" /></label>
					<label>Promotion dice <input name="base_dice" type="number" min="0" value={pr?.promotion.baseDice ?? 1} /></label>
					<label>More per Glorious Deed <input name="per_glorious_deed" type="number" min="0" value={pr?.promotion.perGloriousDeed ?? 1} /></label>
					<label>Promoted anyway after <input name="auto_after" type="number" min="0" value={pr?.promotion.autoAfter ?? 5} /></label>
					<label>ELITE at most <input name="max_elite" type="number" min="0" value={pr?.promotion.maxElite ?? 6} /></label>
					<label>Skill Tables to pick <input name="tables_to_pick" type="number" min="0" value={pr?.advancement.tablesToPick ?? 2} /></label>
					<label>Advancement die <select name="dice" value={pr?.advancement.dice ?? '2D6'}>{#each DICE as d (d)}<option value={d}>{d}</option>{/each}</select></label>
					<label class="wide">Text <textarea name="text" rows="5">{pr?.text ?? ''}</textarea></label>
				</fieldset>
				{#if errorsAt('progression')}<ul class="error" role="alert">{#each errorsAt('progression') ?? [] as e, i (i)}<li><code>{e.path}</code> {e.message}</li>{/each}</ul>{/if}
				<div class="actions"><button>Save</button>{#if saved('progression')}<span class="ok" role="status">Saved.</span>{/if}</div>
			</form>
			{#if data.progression?.revertible}
				<form method="POST" action="?/revert" use:enhance={keep}><input type="hidden" name="id" value="progression" /><button class="ghost">Revert to book</button></form>
			{/if}
		{:else}
			{#key sel?.id ?? 'new'}
				<TableForm t={sel ?? blank} errors={errorsAt(sel?.id || 'new')} saved={saved(sel?.id)} />
			{/key}
			{#if sel?.revertible}
				<form method="POST" action="?/revert" use:enhance={keep}><input type="hidden" name="id" value={sel.id} /><button class="ghost">Revert to book</button></form>
			{:else if sel?.origin === 'custom'}
				<details class="confirm">
					<summary>Remove…</summary>
					<form method="POST" action="?/remove" use:enhance={keep}><input type="hidden" name="id" value={sel.id} /><button class="danger">Remove {sel.name}</button></form>
				</details>
			{/if}
		{/if}
	</section>
</div>

<style>
	.crumb {
		margin: 0;
		font-size: 0.9rem;
	}
	.crumb a {
		color: var(--muted);
	}
	.workbench {
		display: grid;
		grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}
	.entries {
		position: sticky;
		top: 8px;
		display: grid;
		gap: 6px;
		max-height: calc(100dvh - 16px);
		overflow: auto;
		border-top: 2px solid var(--ink);
		padding-top: 6px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 8px;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
		font-size: 0.92rem;
	}
	li a {
		color: var(--ink);
		text-decoration: none;
		font-weight: 600;
	}
	li a:hover,
	li.on a {
		color: var(--blood);
	}
	li.on {
		box-shadow: inset 2px 0 0 var(--blood);
		padding-left: 6px;
	}
	.meta {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.tick {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--supplies);
	}
	.add {
		padding: 6px 0;
		font-weight: 600;
		text-decoration: none;
	}
	.add[aria-current='true'] {
		color: var(--blood);
	}
	.pane {
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	.prog {
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
	.grid {
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
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
	label > textarea {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.error {
		color: var(--blood);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.ok {
		color: var(--supplies);
	}
	.confirm summary {
		cursor: pointer;
		color: var(--blood);
	}
	.danger {
		background: var(--blood);
		border-color: var(--blood);
	}
	@media (max-width: 48rem) {
		.workbench {
			grid-template-columns: minmax(0, 1fr);
		}
		.entries {
			position: static;
			max-height: 15rem;
		}
	}
</style>
