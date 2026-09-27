<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const tops = $derived(data.entries.filter((e) => !e.parent));
	const variantsOf = (id: string) => data.entries.filter((e) => e.parent === id);
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<h1>Faction Studio</h1>
<p class="lede">
	Write your own factions and variants, or change book entries as house rules. Everything saved here is kept when the books are imported
	again; an edited book entry can be put back as printed. The builder, New Warband and the compendium pick changes up at once.
</p>

<div class="start">
	<section>
		<h3>Template</h3>
		<p>A commented file with every key, restriction and keyword, and a worked example. Fill it in and import it below.</p>
		<a class="button" href="/admin/studio/template.yaml" download>Download the template</a>
	</section>
	<section>
		<h3>New faction</h3>
		<form method="POST" action="?/newFaction" class="stack">
			<label>Name <input name="name" required maxlength="80" placeholder="Carnival of Saints" /></label>
			<label>Alignment <select name="alignment"><option value="faithful">Faithful</option><option value="fallen">Fallen</option></select></label>
			<button>Create</button>
		</form>
	</section>
	<section>
		<h3>New variant</h3>
		<form method="POST" action="?/newVariant" class="stack">
			<label>Of <select name="parent">{#each tops.filter((t) => t.id !== 'mercenaries') as t (t.id)}<option value={t.id}>{t.name}</option>{/each}</select></label>
			<label>Name <input name="name" required maxlength="120" placeholder="Order of the Iron Saints" /></label>
			<button>Create</button>
		</form>
	</section>
</div>
{#if form && 'message' in form}<p class="error" role="alert">{form.message}</p>{/if}

<section class="import">
	<h3>Import a template</h3>
	<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance={keep} class="stack">
		<label>File <input type="file" name="file" accept=".yaml,.yml,text/yaml" /></label>
		<label>…or paste it <textarea name="yaml" rows="6" spellcheck="false">{form && 'yaml' in form ? form.yaml : ''}</textarea></label>
		<button>Check it</button>
	</form>
	{#if form && 'errors' in form && form.errors}
		<div class="error" role="alert">
			<p>Nothing was imported. Fix these and try again:</p>
			<ul>{#each form.errors as e, i (i)}<li><code>{e.path}</code> {e.message}</li>{/each}</ul>
		</div>
	{/if}
	{#if form && 'preview' in form && form.preview}
		{@const p = form.preview}
		<div class="preview">
			<p>
				<strong>{p.name}</strong> —
				{p.faction === 'created' ? 'a new faction or variant' : p.faction === 'book' ? 'changes to a book faction (saved as house rules)' : 'updates the one already here'}.
				{p.units.filter((u) => u.action === 'created').length} units and {p.items.filter((i) => i.action === 'created').length} armoury items are new;
				{p.units.filter((u) => u.action === 'changed').length + p.items.filter((i) => i.action === 'changed').length} entries already here are replaced.
				{#if p.keywords.length}New or changed keywords: {p.keywords.join(', ')}.{/if}
			</p>
			<table>
				<thead><tr><th>Entry</th><th>Kind</th><th>Cost</th><th></th></tr></thead>
				<tbody>
					{#each [...p.units, ...p.items] as e, i (i)}
						<tr><td>{e.name}</td><td>{e.category}</td><td>{e.cost} {e.currency === 'glory' ? 'G' : 'D'}</td><td class={e.action}>{e.action === 'created' ? 'new' : 'replaces'}</td></tr>
					{/each}
				</tbody>
			</table>
			<form method="POST" action="?/import">
				<input type="hidden" name="yaml" value={form.yaml} />
				<input type="hidden" name="apply" value="1" />
				<button>Import {p.name}</button>
			</form>
		</div>
	{/if}
</section>

<h2>Factions</h2>
<ul class="list">
	{#each tops as f (f.id)}
		<li>
			<a href="/admin/studio/{f.id}"><strong>{f.name}</strong></a>
			<span class="meta">{f.alignment}{f.custom ? ' · yours' : ''}</span>
			{#if variantsOf(f.id).length}
				<ul>
					{#each variantsOf(f.id) as v (v.id)}
						<li><a href="/admin/studio/{v.id}">{v.name}</a>{#if v.custom}<span class="meta"> · yours</span>{/if}</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.lede {
		max-width: 64ch;
		color: var(--ink-soft);
	}
	.start {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: 16px 28px;
		margin: 22px 0 8px;
		border-top: 2px solid var(--ink);
		padding-top: 10px;
	}
	.start p {
		margin: 0 0 10px;
		color: var(--ink-soft);
	}
	.stack {
		display: grid;
		gap: 8px;
		justify-items: start;
	}
	.stack label {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
		width: 100%;
	}
	.import {
		border-top: 1px solid var(--rule);
		margin-top: 16px;
		padding-top: 6px;
	}
	.import textarea {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
	}
	.preview {
		margin-top: 14px;
		padding: 12px 14px;
		border-left: 3px solid var(--supplies);
		background: var(--paper-deep, rgba(0, 0, 0, 0.03));
	}
	table {
		border-collapse: collapse;
		margin: 8px 0 12px;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 3px 14px 3px 0;
		border-bottom: 1px solid var(--rule);
	}
	td.created {
		color: var(--supplies);
	}
	td.changed {
		color: var(--blood);
	}
	.list {
		list-style: none;
		padding: 0;
		columns: 18rem;
		column-gap: 28px;
	}
	.list > li {
		break-inside: avoid;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	.list ul {
		list-style: none;
		padding: 2px 0 0 14px;
		font-size: 0.92rem;
	}
	.list a {
		color: var(--ink);
	}
	.meta {
		color: var(--muted);
		font-size: 0.85rem;
		margin-left: 6px;
	}
	.error {
		color: var(--blood);
	}
	code {
		font-size: 0.85rem;
	}
</style>
