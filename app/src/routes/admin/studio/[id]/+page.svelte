<script lang="ts">
	import { enhance } from '$app/forms';
	import Seal from '$lib/components/Seal.svelte';
	import { ITEM_CATEGORIES, KIT_EXCEPT, UNIT_CATEGORIES } from '$lib/faction-template';

	let { data, form } = $props();
	const p = $derived(data.pack);
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const TABS = { identity: 'Identity', rules: 'Rules', units: 'Units', armoury: 'Armoury', keywords: 'Keywords', yaml: 'Template (YAML)' } as const;
	const cats = { elite: 'Elites', troop: 'Troops', mercenary: 'Mercenaries' } as const;
	const itemCats = { ranged: 'Ranged Weapons', melee: 'Melee Weapons', grenade: 'Grenades', armour: 'Armour', shield: 'Shields', equipment: 'Equipment', special: 'Special' } as const;
	const avail = (min: number, max: number | null) => (max == null ? 'any' : min ? `${min}-${max}` : `0-${max}`);
	const abilitiesText = (a: { name: string; text: string }[]) => a.map((x) => `${x.name}: ${x.text}`).join('\n\n');
	const pairs = (xs: { name: string }[], key: 'n' | 'max') => xs.map((x) => `${x.name}: ${(x as Record<string, unknown>)[key]}`).join('\n');
	const errorsAt = (at: string) => (form && 'errors' in form && form.at === at ? form.errors : null);
	const saved = (id: string) => form && 'saved' in form && form.saved === id;
	const ORIGIN = { custom: 'yours', edited: 'house rule', book: '' } as Record<string, string>;
	const unitNames = $derived(p.units.map((u) => u.name));
	const itemNames = $derived(p.items.map((i) => i.name));
	const STIPS = [
		['shield_combo', 'shieldCombo', 'Shield Combo'],
		['bayonet_lug', 'bayonetLug', 'Bayonet Lug'],
		['consumable', 'consumable', 'Consumable'],
		['headgear', 'headgear', 'Headgear'],
		['exploration_only', 'explorationOnly', 'Exploration only']
	] as const;
	const blankUnit = $derived({
		id: '', faction: '', variant: null, name: '', category: (data.id === 'mercenaries' ? 'mercenary' : 'troop') as 'troop' | 'mercenary', cost: 0, currency: 'ducats' as const, availabilityMin: 0, availabilityMax: null,
		stats: {}, keywords: [], abilities: [], battlekitNote: null, powers: null, description: null, kit: null
	} as (typeof p.units)[number]);
	const blankItem = { id: '', name: '', category: 'equipment', cost: 0, currency: 'ducats', limit: null, restrictions: null, type: null, range: null, keywords: [], text: null, description: null, unique: false, stipulations: null } as unknown as (typeof p.items)[number];
</script>

<svelte:head><title>{p.faction.name} · Faction Studio</title></svelte:head>

<datalist id="kw">{#each data.keywordNames as k (k)}<option value={k}></option>{/each}</datalist>
<datalist id="units">{#each unitNames as n (n)}<option value={n}></option>{/each}</datalist>
<datalist id="items">{#each itemNames as n (n)}<option value={n}></option>{/each}</datalist>

<p class="crumb"><a href="/admin/studio">Faction Studio</a>{#if data.parentName} · {data.parentName}{/if}</p>
<div class="head">
	{#if !p.faction.parent}<Seal faction={p.faction.id} size={64} label="{p.faction.name} seal" />{/if}
	<div>
		<h1>{p.faction.name}</h1>
		<p class="meta">
			{p.faction.parent ? 'Variant' : 'Faction'} · {p.faction.alignment} · {data.custom ? 'yours' : 'from the books'} · {p.units.length} units · {p.items.length} armoury items
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

{#snippet unitForm(u: (typeof p.units)[number])}
	{@const kit = data.kits[u.id] ?? { fixed: [], except: [], nothingElse: false, swap: null }}
	<form method="POST" action="?/unit&tab=units" use:enhance={keep} class="grid">
		<input type="hidden" name="id" value={u.id} />
		<label class="wide">Name <input name="name" value={u.name} required /></label>
		<label>Kind <select name="category" value={u.category}>{#each UNIT_CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}</select></label>
		<label>Cost <input name="cost" type="number" min="0" value={u.cost} /></label>
		<label>In <select name="currency" value={u.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
		<label>At least <input name="min" type="number" min="0" value={u.availabilityMin} /></label>
		<label>At most <input name="max" type="number" min="0" value={u.availabilityMax ?? ''} placeholder="any" /></label>
		{#each ['movement', 'ranged', 'melee', 'armour', 'base'] as k (k)}
			<label>{k} <input name={k} value={u.stats[k as keyof typeof u.stats] ?? ''} /></label>
		{/each}
		<label class="wide">Keywords <small>(comma between; new ones go in the Keywords tab)</small><input name="keywords" value={u.keywords.join(', ')} list="kw" /></label>
		<label class="wide">Abilities <small>(Name: text, a blank line between)</small><textarea name="abilities" rows="5">{abilitiesText(u.abilities)}</textarea></label>
		<label class="wide">Battlekit note <small>(as printed; the builder reads it unless the kit below is set)</small><input name="battlekit_note" value={u.battlekitNote ?? ''} /></label>
		<fieldset class="wide">
			<legend><label class="check"><input type="checkbox" name="kit_on" checked={!!u.kit} /> Set the kit by hand</label></legend>
			<label>Always has <small>(armoury items, comma between)</small><input name="kit_fixed" value={kit.fixed.join(', ')} list="items" /></label>
			<div class="checks">
				No other: {#each KIT_EXCEPT as c (c)}<label class="check"><input type="checkbox" name="kit_except" value={c} checked={kit.except.includes(c)} /> {c}</label>{/each}
			</div>
			<label class="check"><input type="checkbox" name="kit_nothing_else" checked={kit.nothingElse} /> Cannot have any other battlekit</label>
			<div class="row3">
				<label>Upgrade: swap <input name="swap_from" value={kit.swap?.from ?? ''} list="items" /></label>
				<label>for <input name="swap_to" value={kit.swap?.to ?? ''} list="items" /></label>
				<label>costing more <input name="swap_extra" type="number" min="0" value={kit.swap?.extra ?? ''} /></label>
			</div>
		</fieldset>
		{#if u.category === 'mercenary'}
			<fieldset class="wide">
				<legend>Hired by <small>(leave empty to read it from the text)</small></legend>
				<div class="row3">
					<label>Alignment <select name="hire_alignment" value={u.kit?.hire?.alignment ?? ''}><option value="">Any</option><option value="faithful">Faithful</option><option value="fallen">Fallen</option></select></label>
					<label class="span2">Only these factions or variants <input name="hire_by" value={u.kit?.hire?.by.join(', ') ?? ''} /></label>
				</div>
			</fieldset>
		{/if}
		{#if u.powers !== null}<label class="wide">Powers <input name="powers" value={u.powers ?? ''} /></label>{/if}
		<label class="wide">Description <textarea name="description" rows="3">{u.description ?? ''}</textarea></label>
		{@render errs(u.id || 'new-unit')}
		<div class="actions wide">
			<button>{u.id ? 'Save' : 'Add unit'}</button>
			{#if saved(u.id)}<span class="ok">Saved.</span>{/if}
		</div>
	</form>
{/snippet}

{#snippet itemForm(i: (typeof p.items)[number])}
	{@const f = data.facts[i.id]}
	<form method="POST" action="?/item&tab=armoury" use:enhance={keep} class="grid">
		<input type="hidden" name="id" value={i.id} />
		<label class="wide">Name <input name="name" value={i.name} required /></label>
		<label>Kind <select name="category" value={i.category}>{#each ITEM_CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}</select></label>
		<label>Type <select name="type" value={i.type ?? ''}><option value="">—</option>{#each ['1-Handed', '2-Handed', 'Grenade', 'Armour', 'Shield', 'Equipment', 'Special'] as t (t)}<option value={t}>{t}</option>{/each}</select></label>
		<label>Range <input name="range" value={i.range ?? ''} placeholder={'24" or Melee'} /></label>
		<label>Cost <input name="cost" type="number" min="0" value={i.cost} /></label>
		<label>In <select name="currency" value={i.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
		<label>Limit <small>(warband)</small><input name="limit" type="number" min="0" value={i.limit ?? ''} /></label>
		<label>Per model <input name="per_model" type="number" min="0" value={f?.perModel ?? ''} /></label>
		<label class="wide">Only for <small>(ELITE, unit names or keywords; empty = anyone)</small><input name="only" value={f?.only.join(', ') ?? ''} list="units" /></label>
		<div class="checks wide">
			{#each STIPS as [name, key, label] (name)}<label class="check"><input type="checkbox" {name} checked={!!f?.[key]} /> {label}</label>{/each}
			<label class="check"><input type="checkbox" name="unique" checked={i.unique} /> Unique to this faction (•)</label>
		</div>
		<label class="wide">Keywords <input name="keywords" value={i.keywords.join(', ')} list="kw" /></label>
		<label class="wide">Rules <textarea name="text" rows="3">{i.text ?? ''}</textarea></label>
		<label class="wide">Description <textarea name="description" rows="2">{i.description ?? ''}</textarea></label>
		{@render errs(i.id || 'new-item')}
		<div class="actions wide">
			<button>{i.id ? 'Save' : 'Add item'}</button>
			{#if saved(i.id)}<span class="ok">Saved.</span>{/if}
		</div>
	</form>
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

{#if data.tab === 'identity'}
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
	{@const r = data.rules}
	<p class="lede">
		What the builder uses{p.faction.parent ? ' for this variant (on top of the faction’s own)' : ''}. It starts from what is read from the rule text; saving pins these
		values, whatever the text says.
	</p>
	<form method="POST" action="?/rules&tab=rules" use:enhance={keep} class="grid">
		<label>Starting Ducats <input name="start_ducats" type="number" min="0" value={r.startDucats} /></label>
		<label>Starting Glory <input name="start_glory" type="number" min="0" value={r.startGlory} /></label>
		<label>Fireteams <input name="fireteams" type="number" min="0" value={r.fireteams} /></label>
		<label>Leader <input name="leader" value={r.leader ?? ''} list="units" /></label>
		<label class="wide">Cannot include <small>(unit names, or “Mercenaries”; comma between)</small><input name="excluded" value={r.excluded.join(', ')} list="units" /></label>
		<label class="half">Must include <small>(one per line, “Name: how many”)</small><textarea name="must_include" rows="3">{pairs(r.mustInclude, 'n')}</textarea></label>
		<label class="half">At most <small>(one per line, “Name: max”)</small><textarea name="caps" rows="3">{pairs(r.caps, 'max')}</textarea></label>
		<label class="wide">No longer required <small>(entries whose usual “must include” is lifted)</small><input name="optional" value={r.optional.join(', ')} list="units" /></label>
		<label class="wide">Free items <small>(given free the first time)</small><input name="free_items" value={r.freeItems.join(', ')} list="items" /></label>
		<fieldset class="wide">
			<legend>Upgrades <small>(a keyword a number of models may take)</small></legend>
			{#each [...r.upgrades, { name: '', keyword: '', max: null, cost: 0, currency: 'ducats', text: '' }] as u, i (i)}
				<div class="upgrade">
					<label>Name <input name="up_name" value={u.name} /></label>
					<label>Keyword <input name="up_keyword" value={u.keyword ?? ''} list="kw" /></label>
					<label>Models <input name="up_max" type="number" min="0" value={u.max ?? ''} placeholder="any" /></label>
					<label>Cost <input name="up_cost" type="number" min="0" value={u.cost} /></label>
					<label>In <select name="up_currency" value={u.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
					<label class="wide">Text <input name="up_text" value={u.text} /></label>
				</div>
			{/each}
		</fieldset>
		<label class="wide">Rule text <small>(shown in the builder’s special rules; “* Name: text”, a blank line between)</small><textarea name="text" rows="10">{p.rules.text}</textarea></label>
		{@render errs('rules')}
		<div class="actions wide"><button>Save rules</button>{#if saved('rules')}<span class="ok">Saved.</span>{/if}</div>
	</form>
{:else if data.tab === 'units'}
	{#each Object.entries(cats) as [cat, label] (cat)}
		{@const list = p.units.filter((u) => u.category === cat)}
		{#if list.length}
			<h3>{label}</h3>
			{#each list as u (u.id)}
				<details class="entry" open={saved(u.id) || !!errorsAt(u.id)}>
					<summary>
						<strong>{u.name}</strong>
						<span class="meta">{avail(u.availabilityMin, u.availabilityMax)} · {u.cost} {u.currency}</span>
						{#if ORIGIN[p.origins[u.id]]}<span class="tick">{ORIGIN[p.origins[u.id]]}</span>{/if}
					</summary>
					{@render unitForm(u)}
					{@render rowTools('unit', u.id)}
				</details>
			{/each}
		{/if}
	{/each}
	<details class="entry add" open={!!errorsAt('new-unit')}>
		<summary><strong>+ Add a unit</strong></summary>
		{@render unitForm(blankUnit)}
	</details>
{:else if data.tab === 'armoury'}
	{#each Object.entries(itemCats) as [cat, label] (cat)}
		{@const list = p.items.filter((i) => i.category === cat)}
		{#if list.length}
			<h3>{label}</h3>
			{#each list as i (i.id)}
				<details class="entry" open={saved(i.id) || !!errorsAt(i.id)}>
					<summary>
						<strong>{i.unique ? '• ' : ''}{i.name}</strong>
						<span class="meta">{i.cost} {i.currency}{i.restrictions ? ` · ${i.restrictions}` : ''}</span>
						{#if ORIGIN[p.origins[i.id]]}<span class="tick">{ORIGIN[p.origins[i.id]]}</span>{/if}
					</summary>
					{@render itemForm(i)}
					{@render rowTools('item', i.id)}
				</details>
			{/each}
		{/if}
	{/each}
	<details class="entry add" open={!!errorsAt('new-item')}>
		<summary><strong>+ Add an armoury item</strong></summary>
		{@render itemForm(blankItem)}
	</details>
{:else if data.tab === 'keywords'}
	<p class="lede">Keywords you write join the glossary: chips in the builder and compendium show their text. Writing one the books already have replaces its text as a house rule.</p>
	{#each p.keywords as k (k.name)}
		<p><strong>{k.name}</strong> <span class="meta">{k.kind ?? ''}</span><br />{k.text}</p>
	{/each}
	<form method="POST" action="?/keyword&tab=keywords" use:enhance={keep} class="grid">
		<label>Keyword <input name="name" required list="kw" /></label>
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
	.entry.add summary strong {
		color: var(--blood);
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
	.grid .wide,
	.grid fieldset {
		grid-column: 1 / -1;
	}
	.grid .half {
		grid-column: span 2;
	}
	fieldset {
		display: grid;
		gap: 8px;
		border: 1px solid var(--rule);
		padding: 8px 12px 12px;
	}
	legend {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.check {
		display: inline-flex !important;
		align-items: center;
		gap: 6px;
	}
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		align-items: center;
		font-size: 0.85rem;
	}
	.row3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 8px 12px;
	}
	.span2 {
		grid-column: span 2;
	}
	.upgrade {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 6px 10px;
		padding-bottom: 8px;
		border-bottom: 1px dashed var(--rule);
	}
	.upgrade .wide {
		grid-column: 1 / -1;
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
	@media (max-width: 34rem) {
		.grid .half,
		.span2 {
			grid-column: 1 / -1;
		}
	}
</style>
