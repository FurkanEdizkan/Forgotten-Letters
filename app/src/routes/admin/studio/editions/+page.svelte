<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const KIND: Record<string, string> = { units: 'Units', items: 'Battlekit', factions: 'Faction rules', keywords: 'Keywords', patrons: 'Patrons', tables: 'Campaign tables' };
	const current = $derived(data.editions.find((e) => e.current));
</script>

<svelte:head><title>Editions · Faction Studio</title></svelte:head>

<p><a href="/admin/studio">← Faction Studio</a></p>
<h1>Editions of the rules</h1>
<p class="lede">
	Each edition is a whole set of rules: units, battlekit, faction rules, keywords, Patrons and campaign tables. A warband is built and checked
	under its own edition, so a new edition changes nothing for anyone until you move warbands to it.
</p>

{#if form && 'message' in form}<p class="error">{form.message}</p>{/if}
{#if form && 'created' in form}<p class="ok">Edition {form.created} made.</p>{/if}
{#if form && 'copied' in form}<p class="ok">{form.copied} entries copied.</p>{/if}
{#if form && 'moved' in form}<p class="ok">{form.moved} warbands moved.</p>{/if}

<table>
	<thead><tr><th>Edition</th><th>Status</th><th>Warbands</th><th></th></tr></thead>
	<tbody>
		{#each data.editions as e (e.id)}
			<tr class:current={e.current}>
				<td><b>{e.id}</b> {e.name !== e.id ? e.name : ''}{e.basedOn ? ` · from ${e.basedOn}` : ''}{#if e.current} <span class="tag">current</span>{/if}</td>
				<td>
					<form method="POST" action="?/status" use:enhance={keep}>
						<input type="hidden" name="id" value={e.id} />
						<select name="status" value={e.status} onchange={(ev) => ev.currentTarget.form?.requestSubmit()} aria-label="Status of {e.id}">
							<option value="draft">Draft</option>
							<option value="live">Live</option>
							<option value="retired">Retired</option>
						</select>
					</form>
				</td>
				<td>{e.warbands}</td>
				<td class="tools">
					<a href="/admin/studio?edition={encodeURIComponent(e.id)}">Edit</a>
					{#if !e.current}
						<form method="POST" action="?/current" use:enhance={keep}><input type="hidden" name="id" value={e.id} /><button>Make current</button></form>
					{/if}
					{#if !e.current && !e.warbands}
						<details class="confirm"><summary>Delete…</summary><form method="POST" action="?/remove" use:enhance={keep}><input type="hidden" name="id" value={e.id} /><button class="danger">Delete edition {e.id} and its rules</button></form></details>
					{/if}
					{#if current && e.id !== current.id}<a href="?from={encodeURIComponent(current.id)}&to={encodeURIComponent(e.id)}">Compare with {current.id}</a>{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<div class="grid">
	<section>
		<h2>New edition</h2>
		<form method="POST" action="?/create" use:enhance={keep} class="stack">
			<label>Edition <input name="id" required maxlength="40" placeholder="1.0.3" /></label>
			<label>Name <input name="name" maxlength="120" placeholder="Rulebook 1.0.3" /></label>
			<label>
				Start from
				<select name="basedOn">
					{#each data.editions as e (e.id)}<option value={e.id} selected={e.current}>{e.id}</option>{/each}
					<option value="">Nothing (empty)</option>
				</select>
			</label>
			<button>Make the edition</button>
		</form>
	</section>

	<section>
		<h2>Copy entries between editions</h2>
		<form method="POST" action="?/copy" use:enhance={keep} class="stack">
			<label>What <select name="kind">{#each Object.entries(KIND) as [k, label] (k)}<option value={k}>{label}</option>{/each}</select></label>
			<div class="row">
				<label>From <select name="from">{#each data.editions as e (e.id)}<option value={e.id} selected={e.current}>{e.id}</option>{/each}</select></label>
				<label>To <select name="to">{#each data.editions as e (e.id)}<option value={e.id}>{e.id}</option>{/each}</select></label>
			</div>
			<label>Which <small>(their ids, one per line; empty for all of them)</small><textarea name="ids" rows="3"></textarea></label>
			<button>Copy</button>
		</form>
	</section>

	<section>
		<h2>Move warbands</h2>
		<form method="POST" action="?/move" use:enhance={keep} class="stack">
			<div class="row">
				<label>Every warband on <select name="from">{#each data.editions as e (e.id)}<option value={e.id}>{e.id} ({e.warbands})</option>{/each}</select></label>
				<label>to <select name="to">{#each data.editions as e (e.id)}<option value={e.id} selected={e.current}>{e.id}</option>{/each}</select></label>
			</div>
			<button>Move them</button>
			<small class="muted">A single warband moves from its own page, after seeing what changes for it.</small>
		</form>
	</section>
</div>

{#if data.compare}
	<section>
		<h2>{data.compare.from} → {data.compare.to}: {data.compare.changes.length} changes</h2>
		<ul class="changes">
			{#each data.compare.changes as c (c.kind + c.id)}
				<li>
					<span class="k">{KIND[c.kind]}</span> <b>{c.name}</b>{c.variant ? ` (${c.variant})` : c.faction ? ` (${c.faction})` : ''}:
					{c.change === 'changed' ? c.fields.map((f) => (f.from === '' ? `${f.field} ${f.to}` : `${f.field} ${f.from} → ${f.to}`)).join('; ') : c.change}
				</li>
			{:else}<li class="muted">The two editions are the same.</li>{/each}
		</ul>
	</section>
{/if}

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 16px 0;
	}
	th,
	td {
		text-align: left;
		padding: 6px 8px;
		border-bottom: 1px solid var(--line, rgba(0, 0, 0, 0.15));
	}
	tr.current td {
		font-weight: 600;
	}
	.tools {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.75rem;
		padding: 1px 6px;
		border: 1px solid currentColor;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 18px;
	}
	.stack {
		display: grid;
		gap: 8px;
	}
	.stack label {
		display: grid;
		gap: 3px;
	}
	.row {
		display: flex;
		gap: 10px;
	}
	.changes {
		font-size: 0.9rem;
	}
	.k {
		font-size: 0.75rem;
		opacity: 0.7;
		text-transform: uppercase;
	}
</style>
