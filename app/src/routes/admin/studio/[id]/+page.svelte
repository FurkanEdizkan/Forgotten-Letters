<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Seal from '$lib/components/Seal.svelte';
	import ItemForm from '$lib/components/ItemForm.svelte';
	import RulesForm from '$lib/components/RulesForm.svelte';
	import RulesLibrary from '$lib/components/RulesLibrary.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import UnitForm from '$lib/components/UnitForm.svelte';
	import Board from './Board.svelte';

	let { data, form } = $props();
	const p = $derived(data.pack);
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const TABS = { board: 'Board', identity: 'Identity', rules: 'Rules', units: 'Units', armoury: 'Armoury', keywords: 'Keywords', yaml: 'Template (YAML)' } as const;
	const avail = (min: number, max: number | null) => (max == null ? 'any' : min ? `${min}-${max}` : `0-${max}`);
	const pairs = (xs: { name: string }[], key: 'n' | 'max') => xs.map((x) => `${x.name}: ${(x as Record<string, unknown>)[key]}`).join('\n');
	const errorsAt = (at: string) => (form && 'errors' in form && form.at === at ? form.errors : null);
	const saved = (id: string) => form && 'saved' in form && form.saved === id;
	const ORIGIN = { custom: 'yours', edited: 'house rule', book: '' } as Record<string, string>;
	const upgradeNames = $derived([...new Set(data.rules.upgrades.flatMap((u) => [u.name, ...(u.keyword ? [u.keyword] : [])]))]);
	const blankUnit = $derived({
		id: '', faction: '', variant: null, name: '', category: (data.id === 'mercenaries' ? 'mercenary' : 'troop') as 'troop' | 'mercenary', cost: 0, currency: 'ducats' as const, availabilityMin: 0, availabilityMax: null,
		stats: {}, keywords: [], abilities: [], battlekitNote: null, powers: null, description: null, kit: null
	} as (typeof p.units)[number]);
	const blankItem = { id: '', name: '', category: 'equipment', cost: 0, currency: 'ducats', limit: null, restrictions: null, type: null, range: null, keywords: [], text: null, description: null, unique: false, stipulations: null } as unknown as (typeof p.items)[number];

	// The entry list: its order (dragged, saved as it changes), a filter, and the entries picked for a bulk copy.
	let order = $state({ unit: [] as string[], item: [] as string[] });
	$effect(() => {
		order.unit = p.units.map((u) => u.id);
		order.item = p.items.map((i) => i.id);
	});
	let filter = $state('');
	let picked = $state<string[]>([]);
	const kindOf = $derived(data.tab === 'armoury' ? 'item' : 'unit');
	const tabOf = (kind: 'unit' | 'item') => (kind === 'unit' ? 'units' : 'armoury');
	const entryOf = (kind: 'unit' | 'item', id: string) => (kind === 'unit' ? p.units.find((u) => u.id === id) : p.items.find((i) => i.id === id));
	const selectedId = $derived(data.entry === 'new' ? '' : (data.entry ?? (kindOf === 'unit' ? p.units[0]?.id : p.items[0]?.id) ?? ''));
	async function saveOrder(kind: 'unit' | 'item', ids: string[]) {
		const body = new FormData();
		body.set('kind', kind);
		for (const id of ids) body.append('id', id);
		await fetch('?/order', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
	}
	// The board's open card: "unit:<id>", "item:<id>" (or ":new"), or "rules".
	const cardKind = $derived(data.card?.split(':')[0] ?? null);
	const cardId = $derived(data.card?.slice(data.card.indexOf(':') + 1) ?? '');
	$effect(() => {
		if (data.tab === 'board' && cardId === 'new' && form && 'saved' in form && (cardKind === 'unit' || cardKind === 'item') && entryOf(cardKind, String(form.saved)))
			goto(`?tab=board&card=${cardKind}:${encodeURIComponent(String(form.saved))}`, { replaceState: true, noScroll: true });
	});
	// A new entry, once saved, becomes the one open.
	$effect(() => {
		if (data.entry === 'new' && form && 'saved' in form && entryOf(kindOf, String(form.saved))) goto(`?tab=${data.tab}&entry=${encodeURIComponent(String(form.saved))}`, { replaceState: true, noScroll: true });
	});
</script>

<svelte:head><title>{p.faction.name} · Faction Studio</title></svelte:head>

<datalist id="dl-keyword">{#each data.keywordNames as k (k)}<option value={k}></option>{/each}</datalist>
<datalist id="dl-unit">{#each p.units as u (u.id)}<option value={u.name}></option>{/each}</datalist>
<datalist id="dl-item">{#each data.itemNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-upgrade">{#each upgradeNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-faction">{#each data.factionIds as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="dl-skill"></datalist>
<datalist id="dl-patron">{#each data.patronNames as n (n)}<option value={n}></option>{/each}</datalist>

<p class="crumb"><a href="/admin/studio">Faction Studio</a>{#if data.parentName} · {data.parentName}{/if}</p>
<div class="head">
	{#if !p.faction.parent}<Seal faction={p.faction.id} size={64} label="{p.faction.name} seal" />{/if}
	<div>
		<h1>{p.faction.name}</h1>
		<p class="meta">
			{p.faction.parent ? 'Variant' : 'Faction'} · {p.faction.alignment} · {data.custom ? 'yours' : 'from the books'} · {p.units.length} units · {p.items.length} armoury items · edition <a href="/admin/studio/editions">{data.edition}</a>
		</p>
	</div>
	<a class="button" href="/admin/studio/{data.id}/export.yaml" download>Download as template</a>
</div>

<nav class="tabs" aria-label="Sections">
	{#each Object.entries(TABS) as [t, label] (t)}
		<a href="?tab={t}" aria-current={data.tab === t ? 'page' : undefined}>{label}</a>
	{/each}
</nav>
{#if form && 'message' in form}<p class="error" role="alert">{form.message}</p>{/if}

{#snippet errs(at: string)}
	{#if errorsAt(at)}
		<ul class="error" role="alert">{#each errorsAt(at) ?? [] as e, i (i)}<li><code>{e.path.replace(/^(units|armoury)\[0\]\./, '')}</code> {e.message}</li>{/each}</ul>
	{/if}
{/snippet}

{#snippet rowTools(kind: 'unit' | 'item', id: string)}
	{#if p.origins[id] === 'edited'}
		<form method="POST" action="?/revert&tab={kind === 'unit' ? 'units' : 'armoury'}" use:enhance={keep} class="tool">
			<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
			<button class="ghost">Revert to book</button>
		</form>
	{:else if p.origins[id] === 'custom'}
		<form method="POST" action="?/remove&tab={kind === 'unit' ? 'units' : 'armoury'}" use:enhance={keep} class="tool">
			<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
			<button class="ghost danger">Remove</button>
		</form>
	{/if}
{/snippet}

{#if data.tab === 'board'}
	{#snippet cardErrors()}{@render errs(cardKind === 'rules' ? 'rules' : cardId === 'new' ? `new-${cardKind}` : cardId)}{/snippet}
	{#snippet drawer()}
		{#key data.card}
			{#if cardKind === 'unit'}
				{@const u = (cardId !== 'new' && p.units.find((x) => x.id === cardId)) || blankUnit}
				<UnitForm {u} kit={data.kits[u.id] ?? { fixed: [], except: [], nothingElse: false, swap: null }} glossary={data.glossary} errors={cardErrors} saved={!!saved(u.id)} />
			{:else if cardKind === 'item'}
				{@const i = (cardId !== 'new' && p.items.find((x) => x.id === cardId)) || blankItem}
				<ItemForm {i} facts={data.facts[i.id]} glossary={data.glossary} errors={cardErrors} saved={!!saved(i.id)} />
			{:else}
				<RulesForm r={data.rules} own={p.rules.overrides ?? {}} text={p.rules.text} isVariant={!!p.faction.parent} patrons={data.patronNames} errors={cardErrors} saved={!!saved('rules')} />
			{/if}
		{/key}
	{/snippet}
	<Board
			units={p.units}
			items={p.items}
			rules={data.rules}
			origins={p.origins}
			glossary={data.glossary}
			library={{ keywords: data.library.keywords, items: data.others.items, units: data.others.units, limits: data.library.limits }}
			card={data.card}
			inherited={data.inherited}
			{drawer}
		/>
{:else if data.tab === 'identity'}
	{#if data.custom}
		<form method="POST" action="?/identity&tab=identity" use:enhance={keep} class="grid">
			<label class="wide">Name <input name="name" value={p.faction.name} disabled={!!p.faction.parent} /></label>
			{#if !p.faction.parent}
				<label>Alignment <select name="alignment" value={p.faction.alignment}><option value="faithful">Faithful</option><option value="fallen">Fallen</option></select></label>
				<label>Seal metal <input type="color" name="metal" value={p.faction.colours?.metal ?? '#b8b0a0'} /></label>
				<label>Shadow <input type="color" name="low" value={p.faction.colours?.low ?? '#8f8570'} /></label>
				<label>Light <input type="color" name="high" value={p.faction.colours?.high ?? '#ece5d3'} /></label>
			{/if}
			<label class="wide">Description <small>(shown on its compendium page)</small><textarea name="description" rows="5">{p.faction.description ?? ''}</textarea></label>
			<div class="actions wide"><button>Save</button>{#if saved('identity')}<span class="ok">Saved.</span>{/if}</div>
		</form>
		<details class="danger-zone">
			<summary>Delete {p.faction.name}…</summary>
			<p>Removes it{p.faction.parent ? '' : ', its variants'} and every unit and item you wrote for it. Warbands already built keep their fighters.</p>
			<form method="POST" action="?/delete"><button class="danger">Delete {p.faction.name} for good</button></form>
		</details>
	{:else}
		<p class="lede">A faction from the books keeps its name and seal. Change its rules, units and armoury in the other tabs; each change is kept as a house rule.</p>
	{/if}
{:else if data.tab === 'rules'}
	{#snippet rulesErrors()}{@render errs('rules')}{/snippet}
	<div class="workbench two">
		<section class="pane" aria-label="Rules">
			<RulesForm r={data.rules} own={p.rules.overrides ?? {}} text={p.rules.text} isVariant={!!p.faction.parent} patrons={data.patronNames} errors={rulesErrors} saved={!!saved('rules')} />
		</section>
		<div class="lib"><RulesLibrary {...data.library} /></div>
	</div>
{:else if data.tab === 'units' || data.tab === 'armoury'}
	{@const kind = kindOf}
	{@const ids = order[kind]}
	{@const sel = (selectedId && entryOf(kind, selectedId)) || (kind === 'unit' ? blankUnit : blankItem)}
	{#snippet entryRow(id: string)}
		{@const e = entryOf(kind, id)}
		{#if e}
			<div class="ent" class:on={sel.id === id}>
				<input
					type="checkbox"
					aria-label="Pick {e.name}"
					checked={picked.includes(id)}
					onchange={(ev) => (picked = ev.currentTarget.checked ? [...picked, id] : picked.filter((x) => x !== id))}
				/>
				<a href="?tab={tabOf(kind)}&entry={encodeURIComponent(id)}" aria-current={sel.id === id ? 'true' : undefined} data-sveltekit-noscroll>
					{'unique' in e && e.unique ? '• ' : ''}{e.name}
				</a>
				<span class="meta">{e.cost}{e.currency === 'glory' ? 'G' : ''}{'availabilityMax' in e ? ` · ${avail(e.availabilityMin, e.availabilityMax)}` : ''}</span>
				{#if ORIGIN[p.origins[id]]}<span class="tick">{ORIGIN[p.origins[id]]}</span>{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet formErrors()}{@render errs(sel.id || (kind === 'unit' ? 'new-unit' : 'new-item'))}{/snippet}
	<div class="workbench">
		<nav class="entries" aria-label={kind === 'unit' ? 'Units' : 'Armoury'}>
			<input type="search" bind:value={filter} placeholder="Find {kind === 'unit' ? 'a unit' : 'an item'}…" aria-label="Find" />
			<div class="bulk">
				<label class="check">
					<input type="checkbox" checked={picked.length > 0 && picked.length === ids.length} onchange={(e) => (picked = e.currentTarget.checked ? [...ids] : [])} />
					{picked.length ? `${picked.length} picked` : 'Pick all'}
				</label>
				{#if picked.length}
					<form method="POST" action="?/copyTo" use:enhance={keep} class="copy">
						<input type="hidden" name="kind" value={kind} />
						{#each picked as id (id)}<input type="hidden" name="id" value={id} />{/each}
						<select name="to" aria-label="Copy to edition" required>
							<option value="">Copy to edition…</option>
							{#each data.editions.filter((e) => e.id !== data.edition) as e (e.id)}<option value={e.id}>{e.id}{e.status !== 'live' ? ` (${e.status})` : ''}</option>{/each}
						</select>
						<button class="ghost mini">Copy</button>
					</form>
				{/if}
			</div>
			{#if form && 'copied' in form}<p class="ok" role="status">{form.copied} copied to {form.to}.</p>{/if}
			{#if filter.trim()}
				<ul class="flat">
					{#each ids.filter((id) => entryOf(kind, id)?.name.toLowerCase().includes(filter.trim().toLowerCase())) as id (id)}<li>{@render entryRow(id)}</li>{/each}
				</ul>
			{:else}
				<SortableList bind:items={order[kind]} label="Order of the {kind === 'unit' ? 'units' : 'armoury'}" keyOf={(id) => id} onmove={(xs) => saveOrder(kind, xs)}>
					{#snippet row(id)}{@render entryRow(id)}{/snippet}
				</SortableList>
			{/if}
			<a class="add" href="?tab={tabOf(kind)}&entry=new" aria-current={!sel.id ? 'true' : undefined} data-sveltekit-noscroll>+ New {kind === 'unit' ? 'unit' : 'armoury item'}</a>
		</nav>
		<section class="pane" aria-label={sel.name || 'New entry'}>
			{#key sel.id || 'new'}
				{#if kind === 'unit'}
					{@const u = sel as (typeof p.units)[number]}
					<UnitForm {u} kit={data.kits[u.id] ?? { fixed: [], except: [], nothingElse: false, swap: null }} glossary={data.glossary} errors={formErrors} saved={!!saved(u.id)} />
				{:else}
					{@const i = sel as (typeof p.items)[number]}
					<ItemForm {i} facts={data.facts[i.id]} glossary={data.glossary} errors={formErrors} saved={!!saved(i.id)} />
				{/if}
			{/key}
			{#if sel.id}{@render rowTools(kind, sel.id)}{/if}
		</section>
		<div class="lib"><RulesLibrary {...data.library} /></div>
	</div>
{:else if data.tab === 'keywords'}
	<p class="lede">
		Keywords you write join the glossary: chips in the builder and compendium show their text. Writing one the books already have replaces its text as a house rule.
		<a href="/admin/studio/keywords">Open the keyword library</a> for every keyword of the edition, what carries it, and the ones still missing an explanation.
	</p>
	{#each p.keywords as k (k.name)}
		<p><strong>{k.name}</strong> <span class="meta">{k.kind ?? ''}</span><br />{k.text}</p>
	{/each}
	<form method="POST" action="?/keyword&tab=keywords" use:enhance={keep} class="grid">
		<label>Keyword <input name="name" required list="dl-keyword" /></label>
		<label>Kind <select name="kind"><option value="Tag">Tag</option><option value="Effect">Effect</option><option value="Tag, Effect">Tag, Effect</option></select></label>
		<label class="wide">What it means <textarea name="text" rows="3" required></textarea></label>
		<div class="actions wide"><button>Save keyword</button>{#if form && 'saved' in form && data.keywordNames.includes(String(form.saved))}<span class="ok">Saved.</span>{/if}</div>
	</form>
{:else}
	<p class="lede">
		This {p.faction.parent ? 'variant' : 'faction'} in the template format. Edit it here and apply, or download it, change it anywhere and import it from the
		Studio’s front page. <a href="/admin/studio/template.yaml" download>The documented template</a> lists every key.
	</p>
	<form method="POST" action="?/yaml&tab=yaml" use:enhance={keep} class="stack">
		<textarea name="yaml" rows="30" spellcheck="false">{form && 'at' in form && form.at === 'yaml' ? '' : data.yaml}</textarea>
		{@render errs('yaml')}
		<div class="actions"><button>Apply</button>{#if saved('yaml')}<span class="ok">Applied.</span>{/if}</div>
	</form>
{/if}

<style>
	.crumb {
		margin: 0;
		font-size: 0.9rem;
	}
	.crumb a {
		color: var(--muted);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 18px;
	}
	.head h1 {
		margin: 0;
	}
	.head .button {
		margin-left: auto;
	}
	.lede {
		max-width: 64ch;
		color: var(--ink-soft);
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 22px;
		margin: 18px 0 12px;
		border-bottom: 2px solid var(--ink);
	}
	.tabs a {
		padding: 6px 0;
		color: var(--ink);
		text-decoration: none;
		font-weight: 600;
		border-bottom: 3px solid transparent;
		margin-bottom: -2px;
	}
	.tabs a[aria-current='page'] {
		color: var(--blood);
		border-bottom-color: var(--blood);
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
	}
	.grid label small {
		color: var(--muted);
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	.check {
		display: inline-flex !important;
		align-items: center;
		gap: 6px;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.stack {
		display: grid;
		gap: 8px;
	}
	.stack textarea {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
	}
	.tool {
		padding: 0 2px 12px;
	}
	.danger,
	.error {
		color: var(--blood);
	}
	.ok {
		color: var(--supplies);
	}
	.danger-zone {
		margin-top: 24px;
	}
	.danger-zone summary {
		cursor: pointer;
		color: var(--blood);
	}
	/* The Rules Editor: entries | form | library; each side pane scrolls on its own. */
	.workbench {
		display: grid;
		grid-template-columns: minmax(14rem, 17rem) minmax(0, 1fr) minmax(14rem, 18rem);
		gap: 20px;
		align-items: start;
	}
	.entries,
	.lib {
		position: sticky;
		top: 8px;
		display: grid;
		gap: 6px;
		max-height: calc(100dvh - 16px);
		overflow: auto;
	}
	.lib {
		display: flex;
		flex-direction: column;
	}
	.lib > :global(.library) {
		flex: 1;
		min-height: 0;
	}
	.entries {
		border-top: 2px solid var(--ink);
		padding-top: 6px;
	}
	.ent {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 8px;
		font-size: 0.92rem;
	}
	.ent a {
		color: var(--ink);
		text-decoration: none;
		font-weight: 600;
	}
	.ent a:hover,
	.ent.on a {
		color: var(--blood);
	}
	.ent.on {
		box-shadow: inset 2px 0 0 var(--blood);
		padding-left: 6px;
	}
	.ent input[type='checkbox'] {
		align-self: center;
	}
	.flat {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.flat li {
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		align-items: center;
		font-size: 0.85rem;
	}
	.copy {
		display: flex;
		gap: 4px;
	}
	.copy select {
		padding: 2px 4px;
		font-size: 0.85rem;
	}
	.mini {
		padding: 2px 10px;
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
		min-width: 0;
	}
	.workbench.two {
		grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
	}
	@media (max-width: 78rem) {
		.workbench,
		.workbench.two {
			grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
		}
		.lib {
			grid-column: 1 / -1;
			position: static;
			max-height: 28rem;
		}
	}
	@media (max-width: 48rem) {
		.workbench,
		.workbench.two {
			grid-template-columns: minmax(0, 1fr);
		}
		.entries {
			position: static;
			max-height: 15rem;
		}
	}
</style>
