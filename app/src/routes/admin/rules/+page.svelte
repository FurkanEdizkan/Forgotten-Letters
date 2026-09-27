<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const avail = (min: number, max: number | null) => (max == null ? 'any' : min ? `${min}-${max}` : `0-${max}`);
	const cats = { elite: 'Elites', troop: 'Troops', mercenary: 'Mercenaries' } as const;
	const itemCats = { ranged: 'Ranged Weapons', melee: 'Melee Weapons', grenade: 'Grenades', armour: 'Armour', shield: 'Shields', equipment: 'Equipment', special: 'Special' } as const;
	const abilitiesText = (a: { name: string; text: string }[]) => a.map((x) => `${x.name}: ${x.text}`).join('\n\n');
	const BOOKS = { core: 'Core rules', campaign: 'Campaign rules', scenario: 'Scenarios' } as const;
	const q = (f: string) => `?f=${f}${data.todo ? '&todo' : ''}`;
</script>

<h1>Rules</h1>
<p class="lede">
	The factions, units, armoury and keywords behind the compendium and the warband builder, read from your own rulebooks by
	<code>app/scripts/import-rules.py</code>. Nothing here is committed. Check entries against the books, correct what the reader
	got wrong, and mark them verified: verified entries are kept when you import again.
</p>

<section class="rules-box">
	<h3>Import</h3>
	<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance class="row">
		<input type="file" name="file" accept="application/json,.json" />
		<button>Load rules.json</button>
	</form>
	{#if form && 'imported' in form && form.imported}
		<p class="ok">
			Loaded {form.imported.units} units, {form.imported.items} armoury items and {form.imported.keywords} keywords; {form.imported.kept} verified
			entries kept as they were.
		</p>
	{/if}
	{#if form && 'importMessage' in form}<p class="error">{form.importMessage}</p>{/if}
</section>

<nav class="factions" aria-label="Rules by faction">
	{#each data.factions as f (f.id)}
		<a href={q(f.id)} aria-current={data.selected === f.id ? 'page' : undefined}>
			{f.name}
			<small>{f.units} units · {f.items} kit{#if f.unverified} · <strong>{f.unverified} to check</strong>{/if}</small>
		</a>
	{/each}
	<a href={q('keywords')} aria-current={data.selected === 'keywords' ? 'page' : undefined}>Keywords <small>{data.keywordCount}</small></a>
	{#each data.books as b (b.id)}
		<a href={q(`pages-${b.id}`)} aria-current={data.selected === `pages-${b.id}` ? 'page' : undefined}>
			{BOOKS[b.id]}
			<small>{b.pages} pages{#if b.unverified} · <strong>{b.unverified} to check</strong>{/if}</small>
		</a>
	{/each}
	<label class="todo">
		<input type="checkbox" checked={data.todo} onchange={(e) => (location.href = e.currentTarget.checked ? `?f=${data.selected}&todo` : `?f=${data.selected}`)} />
		Only entries not yet verified
	</label>
</nav>

{#if data.units.length}
	<h2>Units</h2>
	{#each Object.entries(cats) as [cat, label] (cat)}
		{@const list = data.units.filter((u) => u.category === cat)}
		{#if list.length}
			<h3>{label}</h3>
			{#each list as u (u.id)}
				<details class="entry" class:done={u.verified}>
					<summary>
						<strong>{u.name}</strong>{u.variant ? ` · ${u.variant}` : ''}
						<span class="meta">{avail(u.availabilityMin, u.availabilityMax)} · {u.cost} {u.currency} · p.{u.page}</span>
						{#if u.verified}<span class="tick">verified</span>{/if}
					</summary>
					<form method="POST" action="?/unit" use:enhance={keep} class="grid">
						<input type="hidden" name="id" value={u.id} />
						<label class="wide">Name <input name="name" value={u.name} /></label>
						<label>Cost <input name="cost" type="number" min="0" value={u.cost} /></label>
						<label>In <select name="currency" value={u.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
						<label>Kind <select name="category" value={u.category}><option value="elite">Elite</option><option value="troop">Troop</option><option value="mercenary">Mercenary</option></select></label>
						<label>Min <input name="min" type="number" min="0" value={u.availabilityMin} /></label>
						<label>Max <input name="max" type="number" min="0" value={u.availabilityMax ?? ''} placeholder="any" /></label>
						{#each ['movement', 'ranged', 'melee', 'armour', 'base'] as k (k)}
							<label>{k} <input name={k} value={u.stats[k as keyof typeof u.stats] ?? ''} /></label>
						{/each}
						<label class="wide">Keywords <input name="keywords" value={u.keywords.join(', ')} /></label>
						<label class="wide">Abilities <small>(Name: text, a blank line between)</small><textarea name="abilities" rows="6">{abilitiesText(u.abilities)}</textarea></label>
						<label class="wide">Battlekit <input name="battlekitNote" value={u.battlekitNote ?? ''} /></label>
						{#if u.powers !== null}<label class="wide">Powers <input name="powers" value={u.powers ?? ''} /></label>{/if}
						<label class="wide">Description <textarea name="description" rows="3">{u.description ?? ''}</textarea></label>
						<label class="check"><input type="checkbox" name="verified" checked={u.verified} /> Checked against the book</label>
						<button>Save</button>
					</form>
				</details>
			{/each}
		{/if}
	{/each}
{/if}

{#if data.items.length}
	<h2>Armoury</h2>
	{#each Object.entries(itemCats) as [cat, label] (cat)}
		{@const list = data.items.filter((i) => i.category === cat)}
		{#if list.length}
			<h3>{label}</h3>
			{#each list as i (i.id)}
				<details class="entry" class:done={i.verified}>
					<summary>
						<strong>{i.unique ? '• ' : ''}{i.name}</strong>
						<span class="meta">{i.cost} {i.currency}{i.limit ? ` · limit ${i.limit}` : ''}{i.restrictions ? ` · ${i.restrictions}` : ''}{i.type ? '' : ' · no rules yet'}</span>
						{#if i.verified}<span class="tick">verified</span>{/if}
					</summary>
					<form method="POST" action="?/item" use:enhance={keep} class="grid">
						<input type="hidden" name="id" value={i.id} />
						<label class="wide">Name <input name="name" value={i.name} /></label>
						<label>Cost <input name="cost" type="number" min="0" value={i.cost} /></label>
						<label>In <select name="currency" value={i.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
						<label>Limit <input name="limit" type="number" min="0" value={i.limit ?? ''} /></label>
						<label class="wide">Restrictions <input name="restrictions" value={i.restrictions ?? ''} /></label>
						<label>Type <input name="type" value={i.type ?? ''} /></label>
						<label>Range <input name="range" value={i.range ?? ''} /></label>
						<label class="wide">Keywords <input name="keywords" value={i.keywords.join(', ')} /></label>
						<label class="wide">Rules <textarea name="text" rows="4">{i.text ?? ''}</textarea></label>
						<label class="check"><input type="checkbox" name="verified" checked={i.verified} /> Checked against the book</label>
						<button>Save</button>
					</form>
				</details>
			{/each}
		{/if}
	{/each}
{/if}

{#if data.keywords.length}
	<h2>Keywords</h2>
	{#each data.keywords as k (k.name)}
		<details class="entry" class:done={k.verified}>
			<summary><strong>{k.name}</strong> <span class="meta">{k.kind ?? ''}</span>{#if k.verified}<span class="tick">verified</span>{/if}</summary>
			<form method="POST" action="?/keyword" use:enhance={keep} class="grid">
				<input type="hidden" name="name" value={k.name} />
				<label class="wide">Text <textarea name="text" rows="4">{k.text}</textarea></label>
				<label class="check"><input type="checkbox" name="verified" checked={k.verified} /> Checked against the book</label>
				<button>Save</button>
			</form>
		</details>
	{/each}
{/if}

{#if data.pages.length}
	<h2>{BOOKS[data.pages[0].book]}</h2>
	{#each data.pages as p (p.slug)}
		<details class="entry" class:done={p.verified}>
			<summary>
				<strong>{p.title}</strong> <span class="meta">{p.chapter} · p.{p.page} · <a href="/compendium/rules/{p.slug}">view</a></span>
				{#if p.verified}<span class="tick">verified</span>{/if}
			</summary>
			<form method="POST" action="?/page" use:enhance={keep} class="grid">
				<input type="hidden" name="slug" value={p.slug} />
				<label class="wide">Title <input name="title" value={p.title} /></label>
				<label class="wide"
					>Text <small>(blank line between paragraphs; "### " sub-heading, "| a | b" table row, "* " bullet)</small><textarea name="body" rows="16"
						>{p.body}</textarea
					></label
				>
				<label class="check"><input type="checkbox" name="verified" checked={p.verified} /> Checked against the book</label>
				<button>Save</button>
			</form>
		</details>
	{/each}
{/if}

{#if data.selected && !data.units.length && !data.items.length && !data.keywords.length && !data.pages.length}
	<p class="muted"><em>{data.todo ? 'Everything here is verified.' : 'Nothing imported for this yet.'}</em></p>
{/if}

<style>
	.lede {
		max-width: 64ch;
		color: var(--ink-soft);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.factions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 6px 18px;
		margin: 22px 0 8px;
		border-top: 2px solid var(--ink);
		padding-top: 10px;
	}
	.factions a {
		display: grid;
		padding: 4px 0;
		text-decoration: none;
		color: var(--ink);
		font-weight: 600;
	}
	.factions a[aria-current='page'] {
		color: var(--blood);
	}
	.factions small {
		font-weight: 400;
		color: var(--muted);
	}
	.factions small strong {
		color: var(--blood);
	}
	.todo {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.entry {
		border-bottom: 1px solid var(--rule);
	}
	.entry summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
		padding: 8px 2px;
		cursor: pointer;
	}
	.entry.done summary strong {
		color: var(--supplies);
	}
	.meta {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.tick {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--supplies);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 8px 12px;
		padding: 8px 2px 16px;
	}
	.grid label {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
		text-transform: capitalize;
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	.grid .check {
		display: flex;
		align-items: center;
		gap: 6px;
		grid-column: 1 / -1;
		text-transform: none;
	}
	.grid button {
		justify-self: start;
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
	.muted {
		color: var(--muted);
	}
</style>
