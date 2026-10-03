<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const ORIGIN: Record<string, string> = { book: 'book', edited: 'house rule', custom: 'yours' };
	const FILTERS = { all: 'All', book: 'From the books', mine: 'Yours and house rules', unused: 'Unused' } as const;
	let q = $state('');
	let show = $state<keyof typeof FILTERS>('all');
	const shown = $derived(
		data.keywords.filter(
			(k) =>
				(k.name.toLowerCase().includes(q.trim().toLowerCase()) || k.text.toLowerCase().includes(q.trim().toLowerCase())) &&
				(show === 'all' || (show === 'book' ? k.origin === 'book' : show === 'mine' ? k.origin !== 'book' : !k.uses))
		)
	);
	const who = (c: { units: string[]; items: string[]; upgrades: string[] }) =>
		[c.units.length && `${c.units.length} unit${c.units.length > 1 ? 's' : ''}`, c.items.length && `${c.items.length} item${c.items.length > 1 ? 's' : ''}`, c.upgrades.length && `${c.upgrades.length} upgrade${c.upgrades.length > 1 ? 's' : ''}`]
			.filter(Boolean)
			.join(', ');
	const names = (c: { units: string[]; items: string[]; upgrades: string[] }) => [...c.units, ...c.items, ...c.upgrades].join(', ');
	const savedHere = (name: string) => form && 'saved' in form && form.saved === name;
	const errorHere = (name: string) => (form && 'message' in form && form.at === name ? form.message : null);
</script>

<svelte:head><title>Keywords · Faction Studio</title></svelte:head>

{#snippet editor(name: string, kind: string | null, text: string, fixedName: boolean)}
	<form method="POST" action="?/save" use:enhance={keep} class="edit">
		{#if fixedName}<input type="hidden" name="name" value={name} />{:else}<label>Keyword <input name="name" value={name} required maxlength="80" /></label>{/if}
		<label>
			Kind
			<select name="kind" value={kind ?? 'Effect'}>
				<option value="Tag">Tag</option><option value="Effect">Effect</option><option value="Tag, Effect">Tag, Effect</option>
			</select>
		</label>
		<label class="wide">What it means <textarea name="text" rows="3" required>{text}</textarea></label>
		<div class="actions">
			<button>Save</button>
			{#if savedHere(name)}<span class="ok" role="status">Saved.</span>{/if}
			{#if errorHere(name)}<span class="error" role="alert">{errorHere(name)}</span>{/if}
		</div>
	</form>
{/snippet}

<p class="crumb"><a href="/admin/studio">Faction Studio</a></p>
<h1>Keywords</h1>
<p class="lede">
	Every keyword of edition <a href="/admin/studio/editions">{data.edition}</a>. The builder, the compendium and every keyword chip show the text written here; a family entry
	such as <b>IGNORE [MODIFIER]</b> explains IGNORE COVER and the like. Editing a book keyword keeps it as a house rule.
</p>

{#if data.missing.length}
	<section class="rules-box missing">
		<h2>Missing explanations · {data.missing.length}</h2>
		<p class="note">Carried by units, kit or upgrades in this edition, but explained nowhere. Write what each one means:</p>
		<ul>
			{#each data.missing as m (m.name)}
				<li>
					<details open={savedHere(m.name) || !!errorHere(m.name)}>
						<summary><b>{m.name}</b> <span class="meta" title={names(m)}>{who(m)}</span></summary>
						{@render editor(m.name, null, '', true)}
					</details>
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<p class="ok">Every keyword carried in this edition is explained.</p>
{/if}

<details class="new" open={!!(form && 'message' in form && form.at === '')}>
	<summary>+ New keyword</summary>
	{@render editor('', null, '', false)}
</details>

<div class="tools">
	<input type="search" bind:value={q} placeholder="Search names and text…" aria-label="Search keywords" />
	<div class="filters" role="group" aria-label="Show">
		{#each Object.entries(FILTERS) as [k, l] (k)}<button type="button" class="ghost" aria-pressed={show === k} onclick={() => (show = k as keyof typeof FILTERS)}>{l}</button>{/each}
	</div>
	<span class="meta">{shown.length} of {data.keywords.length}</span>
</div>

<ul class="list">
	{#each shown as k (k.name)}
		<li>
			<details open={savedHere(k.name) || !!errorHere(k.name)}>
				<summary>
					<b>{k.name}</b>
					<span class="meta">{k.kind ?? ''}</span>
					{#if k.origin !== 'book'}<span class="tick">{ORIGIN[k.origin]}</span>{/if}
					<span class="meta uses" title={k.carriers ? names(k.carriers) : undefined}>{k.uses ? `carried ${k.uses}×` : 'unused'}</span>
					<span class="text">{k.text || '— no text —'}</span>
				</summary>
				{@render editor(k.name, k.kind, k.text, true)}
				{#if k.origin === 'custom' && !k.uses}
					<form method="POST" action="?/remove" use:enhance={keep} class="remove">
						<input type="hidden" name="name" value={k.name} />
						<button class="ghost danger">Delete {k.name}</button>
					</form>
				{/if}
			</details>
		</li>
	{:else}
		<li class="meta">Nothing matches.</li>
	{/each}
</ul>

<style>
	.crumb {
		margin: 0;
		font-size: 0.9rem;
	}
	.crumb a {
		color: var(--muted);
	}
	.lede {
		max-width: 64ch;
		color: var(--ink-soft);
	}
	.missing ul,
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.missing h2 {
		margin-top: 0;
	}
	.note {
		margin: 0 0 6px;
	}
	.missing li {
		padding: 4px 0;
		border-bottom: 1px solid var(--rule);
	}
	.list {
		border-top: 2px solid var(--ink);
	}
	.list li {
		border-bottom: 1px solid var(--rule);
	}
	summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 12px;
		padding: 7px 2px;
		cursor: pointer;
	}
	.text {
		flex-basis: 100%;
		color: var(--ink-soft);
		font-size: 0.92rem;
		white-space: pre-line;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	details[open] .text {
		display: none;
	}
	.meta {
		color: var(--muted);
		font-size: 0.88rem;
	}
	.uses {
		margin-left: auto;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.tick {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--supplies);
	}
	.edit {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 8px 12px;
		padding: 4px 2px 12px;
	}
	.edit label {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
	}
	.edit .wide,
	.edit .actions {
		grid-column: 1 / -1;
	}
	.edit textarea {
		width: 100%;
		box-sizing: border-box;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.new {
		margin: 18px 0;
	}
	.new > summary {
		font-weight: 600;
		color: var(--blood);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		align-items: center;
		margin: 12px 0 8px;
	}
	.tools input {
		flex: 1 1 14rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.filters button {
		padding: 3px 10px;
		font-size: 0.8rem;
	}
	.filters button[aria-pressed='true'] {
		color: var(--blood);
		border-color: var(--blood);
	}
	.remove {
		padding: 0 2px 12px;
	}
	.ok {
		color: var(--supplies);
	}
	.error,
	.danger {
		color: var(--blood);
	}
</style>
