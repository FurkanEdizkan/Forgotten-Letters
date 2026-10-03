<script lang="ts">
	/**
	 * A warband laid out on a board: its units, its armoury and its rules as cards. Click a card to edit it in the
	 * side panel; drag a card to reorder its lane; drag one in from the library (or focus a lane and click it there)
	 * to take another faction's unit or kit into this warband, or a ready rule into its rules. A book card can be
	 * excluded from the warband, which is the rules' "cannot include".
	 */
	import { deserialize } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import KeywordChips from '$lib/components/KeywordChips.svelte';
	import Mark, { type MarkName } from '$lib/components/Mark.svelte';
	import RulesLibrary from '$lib/components/RulesLibrary.svelte';
	import { accepts, drag, endDrag, startDrag, target, type Kind } from '$lib/components/drag.svelte';
	import { describeLimit, type Limit, type PriceRule } from '$lib/warband-limits';
	import ItemCard from './ItemCard.svelte';
	import UnitCard from './UnitCard.svelte';
	import type { VariantRules } from '$lib/warband-rules';

	type Unit = {
		id: string;
		name: string;
		category: string;
		cost: number;
		currency: string;
		availabilityMin: number;
		availabilityMax: number | null;
		stats: Record<string, unknown>;
		keywords: string[];
		abilities: { name: string; text: string }[];
	};
	type Item = { id: string; name: string; category: string; cost: number; currency: string; limit: number | null; keywords: string[]; unique: boolean; type: string | null; range: string | null; text: string | null };
	type LibEntry = { name: string; note?: string; title?: string; missing?: boolean; value?: unknown };
	let {
		units,
		items,
		rules,
		origins,
		glossary,
		library,
		card,
		kits,
		inherited = { units: [], items: [] },
		drawer
	}: {
		units: Unit[];
		items: Item[];
		rules: VariantRules;
		origins: Record<string, string>;
		glossary: Record<string, string>;
		library: { keywords: LibEntry[]; items: LibEntry[]; units: LibEntry[]; limits: { from: string; label?: string; limit: Limit }[] };
		card: string | null;
		kits: Record<string, { fixed: string[] }>;
		inherited?: { units: (Unit & { faction: string })[]; items: (Item & { faction: string })[] };
		drawer: Snippet;
	} = $props();

	let note = $state<{ text: string; bad?: boolean } | null>(null);
	const isOut = (name: string) => rules.excluded.some((x) => x.toLowerCase() === name.toLowerCase());
	const coin = (cost: number, currency: string) => `${cost} ${currency === 'glory' ? 'G' : 'D'}`;
	/** "+2 DICE" → "+2D", "6\"/Infantry" → "6\"": a card's stat line stays on one line. */
	const short = (v: unknown) => String(v ?? '–').replace(/\s*DICE/i, 'D').replace(/\/.*$/, '');
	const avail = (min: number, max: number | null) => (max == null ? (min ? `${min}+` : 'any') : `${min}-${max}`);
	const ORIGIN: Record<string, string> = { custom: 'yours', edited: 'house rule' };
	const CAT_MARK: Record<string, MarkName> = { ranged: 'ranged', grenade: 'ranged', melee: 'melee', armour: 'armour', shield: 'armour', equipment: 'equipment', special: 'equipment' };
	const open = (c: string) => goto(`?tab=board&card=${encodeURIComponent(c)}`, { noScroll: true, keepFocus: true });

	/** Post to one of the page's actions; reload the board after. */
	async function act(action: string, fields: Record<string, string | string[]>, done?: string) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, x);
		const res = deserialize(await (await fetch(`?/${action}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })).text());
		if (res.type === 'failure') note = { text: String(res.data?.message ?? 'That did not work.'), bad: true };
		else if (done) note = { text: done };
		await invalidateAll();
	}
	const patch = (kind: 'unit' | 'item', id: string) => (p: Record<string, unknown>) => act(kind === 'unit' ? 'patchUnit' : 'patchItem', { id, patch: JSON.stringify(p) });
	const adopt = (v: unknown) => {
		const c = v as { adopt?: string; id?: string; name?: string };
		if (c?.adopt && c.id) act('adopt', { kind: c.adopt, id: c.id }, `${c.name} added to the board.`);
	};
	const addRule = (v: unknown) => v && typeof v === 'object' && !('adopt' in v) && act('addLimit', { limit: JSON.stringify(v) }, 'Rule added.');

	// Lanes keep their own order while dragging; the server saves it as `sort`.
	let order = $state({ unit: [] as string[], item: [] as string[] });
	$effect(() => {
		order.unit = units.map((u) => u.id);
		order.item = items.map((i) => i.id);
	});
	const lane = Symbol('lane');
	let over = $state<string | null>(null);
	function move(kind: 'unit' | 'item', from: number, to: number) {
		const ids = [...order[kind]];
		if (to < 0 || to >= ids.length || from === to) return;
		const [x] = ids.splice(from, 1);
		ids.splice(to, 0, x);
		order[kind] = ids;
		act('order', { kind, id: ids });
	}
	function dropOn(e: DragEvent, kind: 'unit' | 'item' | 'limit', at?: number) {
		e.preventDefault();
		e.stopPropagation();
		over = null;
		if (drag.from === lane && kind !== 'limit' && at != null && (drag.value as { kind: string }).kind === kind) move(kind, drag.index, at);
		else if (kind === 'limit') addRule(drag.value);
		else if ((drag.value as { adopt?: string })?.adopt === kind) adopt(drag.value);
		endDrag();
	}
	const canDrop = (kind: 'unit' | 'item' | 'limit') =>
		(drag.from === lane && (drag.value as { kind: string })?.kind === kind) || (kind === 'limit' ? accepts(['limit']) : (drag.value as { adopt?: string })?.adopt === kind);
	const claim = (kind: Kind, label: string, add: (v: unknown) => void) => Object.assign(target, { kind, label, add });
	function keyMove(e: KeyboardEvent, kind: 'unit' | 'item', i: number) {
		if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) (e.preventDefault(), move(kind, i, i + (e.key === 'ArrowLeft' ? -1 : 1)));
	}

	// The rules lane: one card per rule, all of them edited in the rules panel.
	type RuleCard = { kind: string; title: string; body: string };
	const priceSay = (p: PriceRule) =>
		`${p.entries?.length ? p.entries.join(', ') : p.items?.names?.length ? p.items.names.join(', ') : 'Kit'}${p.first ? ' (the first)' : ''}: ${p.cost != null ? `costs ${p.cost}${p.currency === 'glory' ? ' Glory' : ''}` : p.less != null ? `${p.less} less` : `× ${p.factor}`}`;
	const ruleCards = $derived<RuleCard[]>([
		{ kind: 'Starting out', title: `${rules.startDucats} Ducats · ${rules.startGlory} Glory`, body: rules.fireteams ? `${rules.fireteams} Fireteams` : '' },
		...(rules.leader ? [{ kind: 'Leader', title: rules.leader, body: '' }] : []),
		...(rules.patron ? [{ kind: 'Patron', title: rules.patron, body: 'The warband must serve this Patron.' }] : []),
		...rules.mustInclude.map((m) => ({ kind: 'Must include', title: `${m.n} × ${m.name}`, body: '' })),
		...rules.caps.map((c) => ({ kind: 'At most', title: `${c.max} × ${c.name}`, body: '' })),
		...rules.excluded.filter((x) => !units.some((u) => u.name === x) && !items.some((i) => i.name === x)).map((x) => ({ kind: 'Cannot include', title: x, body: '' })),
		...(rules.freeItems.length ? [{ kind: 'Free items', title: rules.freeItems.join(', '), body: 'Given free the first time.' }] : []),
		...rules.upgrades.map((u) => ({ kind: 'Upgrade', title: `${u.name}${u.keyword ? ` · ${u.keyword}` : ''}`, body: `${u.max == null ? 'Any models' : `Up to ${u.max}`}${u.for.length ? ` of ${u.for.join(', ')}` : ''} · ${coin(u.cost, u.currency)}` })),
		...rules.limits.map((l) => ({ kind: 'Rule', title: l.text ?? describeLimit(l), body: l.text ? describeLimit(l) : '' })),
		...rules.prices.map((p) => ({ kind: 'Price', title: priceSay(p), body: '' })),
		...rules.paragraphs.map((t) => {
			const m = t.replace(/^\*\s*/, '').match(/^([^:]{1,60}):\s*([\s\S]*)$/);
			return { kind: 'Special rule', title: m ? m[1] : 'Rule', body: m ? m[2] : t };
		})
	]);
</script>

<div class="boardwrap workbench" class:withdrawer={!!card}>
	<div class="board">
		{#if !units.length && !items.length && !inherited.units.length}
			<p class="start">An empty board. Make the warband card by card: <b>+ New unit</b>, <b>+ New item</b> and <b>+ New rule</b>, or bring cards in from the library on the right.</p>
		{/if}
		{#if note}<p class={note.bad ? 'error' : 'ok'} role="status">{note.text} <button type="button" class="ghost mini" onclick={() => (note = null)}>×</button></p>{/if}

		{#each [['unit', 'Units', 'unit'], ['item', 'Armoury', 'item']] as [kind, title, lib] (kind)}
			{@const k = kind as 'unit' | 'item'}
			<section
				class="lane"
				class:over={over === k}
				aria-label={title}
				ondragover={(e) => canDrop(k) && (e.preventDefault(), (over = k))}
				ondragleave={() => (over = null)}
				ondrop={(e) => dropOn(e, k, order[k].length - 1)}
			>
				<header>
					<h2>{title} <small>{order[k].length + (k === 'unit' ? inherited.units : inherited.items).length}</small></h2>
					<button type="button" class="ghost mini" onclick={() => claim(lib as Kind, `the ${title.toLowerCase()}`, adopt)}>From the library…</button>
					<button type="button" class="ghost mini" onclick={() => open(`${k}:new`)}>+ New {k === 'unit' ? 'unit' : 'item'}</button>
				</header>
				<div class="cards">
					{#each order[k] as id, i (id)}
						{@const u = k === 'unit' ? units.find((x) => x.id === id) : undefined}
						{@const it = k === 'item' ? items.find((x) => x.id === id) : undefined}
						{@const c = u ?? it}
						{#if c}
							<div class="slot" role="listitem" ondragover={(e) => canDrop(k) && (e.preventDefault(), (over = k))} ondrop={(e) => dropOn(e, k, i)}>
								{#snippet tools()}
									<button type="button" class="ghost mini" onclick={() => act('exclude', { name: c.name, on: isOut(c.name) ? '0' : '1' })}>{isOut(c.name) ? 'Include' : 'Exclude'}</button>
									{#if origins[id] === 'custom'}<button type="button" class="ghost mini" onclick={() => act('remove', { kind: k, id }, `${c.name} removed.`)}>Remove</button>{/if}
								{/snippet}
								{#if u}
									<UnitCard
										{u}
										fixed={kits[u.id]?.fixed ?? []}
										{glossary}
										tag={ORIGIN[origins[id]] ?? ''}
										out={isOut(u.name)}
										open={card === `unit:${id}`}
										patch={patch('unit', id)}
										onmore={() => open(`unit:${id}`)}
										ondragstart={(e) => startDrag(e, 'row', { kind: 'unit', id, name: u.name }, lane, i)}
										children={tools}
									/>
								{:else if it}
									<ItemCard
										{it}
										{glossary}
										tag={ORIGIN[origins[id]] ?? ''}
										out={isOut(it.name)}
										open={card === `item:${id}`}
										patch={patch('item', id)}
										onmore={() => open(`item:${id}`)}
										ondragstart={(e) => startDrag(e, 'row', { kind: 'item', id, name: it.name }, lane, i)}
										children={tools}
									/>
								{/if}
							</div>
						{/if}
					{/each}
					{#each k === 'unit' ? inherited.units : inherited.items as c (c.id)}
						<div class="slot">
							{#snippet itools()}
								<button type="button" class="ghost mini" onclick={() => act('exclude', { name: c.name, on: isOut(c.name) ? '0' : '1' })}>{isOut(c.name) ? 'Include' : 'Exclude'}</button>
								<button type="button" class="ghost mini" title="A copy of its own for this variant, to change" onclick={() => act('adopt', { kind: k, id: c.id }, `${c.name} now has a card of its own here.`)}>Change here</button>
							{/snippet}
							{#if 'abilities' in c}
								<UnitCard u={c as Unit} fixed={kits[c.id]?.fixed ?? []} {glossary} tag="from the faction" out={isOut(c.name)} open={false} inherited patch={() => {}} onmore={() => {}} ondragstart={(e) => startDrag(e, 'row', { kind: 'unit', id: c.id, name: c.name })} children={itools} />
							{:else}
								<ItemCard it={c as Item} {glossary} tag="from the faction" out={isOut(c.name)} open={false} inherited patch={() => {}} onmore={() => {}} ondragstart={(e) => startDrag(e, 'row', { kind: 'item', id: c.id, name: c.name })} children={itools} />
							{/if}
						</div>
					{/each}
					<button type="button" class="card new" onclick={() => open(`${k}:new`)}>+ New {k === 'unit' ? 'unit' : 'item'}<small>or drop one from the library</small></button>
				</div>
			</section>
		{/each}

		<section
			class="lane"
			class:over={over === 'limit'}
			aria-label="Rules"
			ondragover={(e) => canDrop('limit') && (e.preventDefault(), (over = 'limit'))}
			ondragleave={() => (over = null)}
			ondrop={(e) => dropOn(e, 'limit')}
		>
			<header>
				<h2>Rules <small>{ruleCards.length}</small></h2>
				<button type="button" class="ghost mini" onclick={() => claim('limit', 'the warband’s rules', addRule)}>From the library…</button>
				<button type="button" class="ghost mini" onclick={() => open('rules')}>Edit the rules</button>
			</header>
			<div class="cards rules">
				{#each ruleCards as r, i (i)}
					<button type="button" class="card rule" class:open={card === 'rules'} onclick={() => open('rules')}>
						<span class="kind">{r.kind}</span>
						<b>{r.title}</b>
						{#if r.body}<span class="body">{r.body}</span>{/if}
					</button>
				{/each}
				<button type="button" class="card new" onclick={() => open('rules')}>+ New rule<small>or drop a ready rule here</small></button>
			</div>
		</section>
	</div>

	{#if card}
		<aside class="drawer" aria-label="Edit card">
			<header>
				<button type="button" class="ghost mini" onclick={() => goto('?tab=board', { noScroll: true })} aria-label="Close">× Close</button>
			</header>
			{@render drawer()}
		</aside>
	{/if}

	<div class="lib">
		<RulesLibrary keywords={library.keywords} items={library.items} units={library.units} limits={library.limits} />
	</div>
</div>

<style>
	/* The board is Trench Companion's dark register, like the warband pages; the side panel stays a book page. */
	.boardwrap {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);
		gap: 18px;
		align-items: start;
		padding: 16px;
		background: #1b1916;
		color: var(--bone);
	}
	.boardwrap.withdrawer {
		grid-template-columns: minmax(0, 1fr) minmax(28rem, 36rem) minmax(15rem, 17rem);
	}
	.board {
		display: grid;
		gap: 20px;
		min-width: 0;
	}
	.lane.over {
		outline: 2px dashed var(--blood-bright);
		outline-offset: 4px;
	}
	.lane > header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		margin-bottom: 10px;
		padding: 6px 12px;
		background: var(--blood);
	}
	.lane h2 {
		margin: 0 auto 0 0;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: 1.05rem;
		font-weight: 700;
	}
	.lane h2 small {
		font-weight: 400;
		opacity: 0.75;
	}
	.lane > header :global(.mini) {
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
		gap: 12px;
		align-items: start;
	}
	.lane[aria-label='Armoury'] .cards {
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
	.cards.rules {
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
	.slot {
		min-width: 0;
	}
	.card {
		display: grid;
		align-content: start;
		gap: 4px;
		min-height: 5rem;
		padding: 8px 12px;
		border: 1px solid rgba(236, 229, 211, 0.1);
		border-left: 3px solid var(--blood);
		background: #2a2824;
		color: var(--bone);
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		font-size: 0.88rem;
		cursor: pointer;
	}
	.card:hover {
		background: #33302b;
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.25);
	}
	.card.open {
		box-shadow: 0 0 0 2px var(--blood-bright);
	}
	.rule .kind {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--blood-pale);
	}
	.rule .body {
		color: var(--bone-dim);
		font-size: 0.82rem;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card.new {
		place-content: center;
		justify-items: center;
		min-height: 7rem;
		border: 1px dashed rgba(236, 229, 211, 0.25);
		background: transparent;
		color: var(--blood-pale);
		font-weight: 600;
	}
	.card.new small {
		color: var(--bone-dim);
		font-weight: 400;
		font-size: 0.78rem;
	}
	.mini {
		padding: 1px 8px;
		font-size: 0.7rem;
		letter-spacing: 0.03em;
		white-space: nowrap;
		background: transparent;
	}
	.drawer {
		position: sticky;
		top: 8px;
		max-height: calc(100dvh - 16px);
		overflow: auto;
		padding: 0 14px;
		background: var(--paper);
		color: var(--ink);
		border-top: 3px solid var(--blood);
	}
	.drawer > header {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		justify-content: flex-end;
		padding: 6px 0;
		background: var(--paper);
	}
	.lib {
		position: sticky;
		top: 8px;
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - 16px);
		overflow: auto;
		padding: 8px 10px;
		background: #23211d;
	}
	.lib > :global(.library) {
		flex: 1;
		min-height: 0;
	}
	/* The library on the dark board. */
	.lib :global(.library .tabs) {
		border-bottom-color: var(--bone-dim);
	}
	.lib :global(.library .tabs button) {
		color: var(--bone-dim);
		background: transparent;
	}
	.lib :global(.library .tabs button[aria-selected='true']) {
		color: var(--bone);
		border-bottom-color: var(--blood-bright);
	}
	.lib :global(.library input) {
		background: #2a2824;
		border-color: rgba(236, 229, 211, 0.2);
		color: var(--bone);
	}
	.lib :global(.library ul) {
		border-top-color: rgba(236, 229, 211, 0.15);
	}
	.lib :global(.library .entry) {
		color: var(--bone);
		border-bottom-color: rgba(236, 229, 211, 0.1);
	}
	.lib :global(.library .entry:hover) {
		background: #33302b;
		color: var(--bone);
	}
	.lib :global(.library .hint),
	.lib :global(.library .note) {
		color: var(--bone-dim);
	}
	.start {
		margin: 0;
		padding: 10px 12px;
		border: 1px dashed rgba(236, 229, 211, 0.25);
		color: var(--bone-dim);
	}
	.ok {
		color: #9cc06a;
	}
	.board > p :global(button) {
		border: 0;
		color: inherit;
		background: transparent;
	}
	.error {
		color: var(--blood-pale);
	}
	@media (max-width: 100rem) {
		.boardwrap.withdrawer {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);
		}
		.drawer {
			position: fixed;
			z-index: 30;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(38rem, 100vw);
			max-height: none;
		}
	}
</style>
