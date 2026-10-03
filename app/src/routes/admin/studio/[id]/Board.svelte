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
	import type { VariantRules } from '$lib/warband-rules';

	type Unit = { id: string; name: string; category: string; cost: number; currency: string; availabilityMin: number; availabilityMax: number | null; stats: Record<string, unknown>; keywords: string[] };
	type Item = { id: string; name: string; category: string; cost: number; currency: string; limit: number | null; keywords: string[]; unique: boolean; type: string | null; range: string | null };
	type LibEntry = { name: string; note?: string; title?: string; missing?: boolean; value?: unknown };
	let {
		units,
		items,
		rules,
		origins,
		glossary,
		library,
		card,
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
							<article
								class="card {k}"
								class:open={card === `${k}:${id}`}
								class:out={isOut(c.name)}
								draggable="true"
								ondragstart={(e) => startDrag(e, 'row', { kind: k, id }, lane, i)}
								ondragend={endDrag}
								ondragover={(e) => canDrop(k) && (e.preventDefault(), (over = k))}
								ondrop={(e) => dropOn(e, k, i)}
							>
								<header>
									<button type="button" class="opener" aria-label="Edit {c.name} (Alt and arrows move it)" onclick={() => open(`${k}:${id}`)} onkeydown={(e) => keyMove(e, k, i)}
										>{#if it}<Mark name={CAT_MARK[it.category] ?? 'equipment'} /> {/if}{it?.unique ? '• ' : ''}{c.name}</button
									>
									<span class="cost">{coin(c.cost, c.currency)}</span>
								</header>
								{#if u}
									<p class="meta">{u.category} · {avail(u.availabilityMin, u.availabilityMax)}</p>
									<p class="stats">
										{#each ['movement', 'melee', 'ranged', 'armour'] as s (s)}<span><small>{s.slice(0, 3)}</small>{short(u.stats[s])}</span>{/each}
									</p>
								{:else if it}
									<p class="meta">{it.category}{it.type ? ` · ${it.type}` : ''}{it.range ? ` · ${it.range}` : ''}{it.limit != null ? ` · limit ${it.limit}` : ''}</p>
								{/if}
								{#if c.keywords.length}<div class="kw"><KeywordChips keywords={c.keywords.slice(0, 5)} {glossary} /></div>{/if}
								<footer>
									{#if ORIGIN[origins[id]]}<span class="tick">{ORIGIN[origins[id]]}</span>{/if}
									{#if isOut(c.name)}<span class="tick out">excluded</span>{/if}
									<span class="tools">
										<button type="button" class="ghost mini" onclick={(e) => (e.stopPropagation(), act('exclude', { name: c.name, on: isOut(c.name) ? '0' : '1' }))}>
											{isOut(c.name) ? 'Include' : 'Exclude'}
										</button>
										{#if origins[id] === 'custom'}
											<button type="button" class="ghost mini danger" onclick={(e) => (e.stopPropagation(), act('remove', { kind: k, id }, `${c.name} removed.`))}>Remove</button>
										{/if}
									</span>
								</footer>
							</article>
						{/if}
					{/each}
					{#each k === 'unit' ? inherited.units : inherited.items as c (c.id)}
						<article class="card {k} inherited" class:out={isOut(c.name)}>
							<header>
								<b>{c.name}</b>
								<span class="cost">{coin(c.cost, c.currency)}</span>
							</header>
							{#if 'availabilityMin' in c}<p class="meta">{c.category} · {avail(c.availabilityMin, c.availabilityMax)}</p>{:else}<p class="meta">{c.category}</p>{/if}
							{#if c.keywords.length}<div class="kw"><KeywordChips keywords={c.keywords.slice(0, 5)} {glossary} /></div>{/if}
							<footer>
								<span class="tick inh">from the faction</span>
								{#if isOut(c.name)}<span class="tick out">excluded</span>{/if}
								<span class="tools">
									<button type="button" class="ghost mini" onclick={() => act('exclude', { name: c.name, on: isOut(c.name) ? '0' : '1' })}>{isOut(c.name) ? 'Include' : 'Exclude'}</button>
									<button type="button" class="ghost mini" title="A copy of its own for this variant, to change" onclick={() => act('adopt', { kind: k, id: c.id }, `${c.name} now has a card of its own here.`)}>Change here</button>
								</span>
							</footer>
						</article>
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
	.boardwrap {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(15rem, 18rem);
		gap: 20px;
		align-items: start;
	}
	.boardwrap.withdrawer {
		grid-template-columns: minmax(0, 1fr) minmax(26rem, 34rem) minmax(14rem, 16rem);
	}
	.board {
		display: grid;
		gap: 22px;
		min-width: 0;
	}
	.lane {
		border-top: 2px solid var(--ink);
		padding-top: 6px;
	}
	.lane.over {
		outline: 2px dashed var(--blood);
		outline-offset: 4px;
	}
	.lane > header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 10px;
		margin-bottom: 8px;
	}
	.lane h2 {
		margin: 0 auto 0 0;
		font-size: 1.4rem;
	}
	.lane h2 small {
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--muted);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 10px;
	}
	.cards.rules {
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
	}
	.card {
		display: grid;
		align-content: start;
		gap: 4px;
		min-height: 6.5rem;
		padding: 8px 10px;
		border: 1px solid var(--rule);
		border-top: 2px solid var(--ink);
		background: #fff;
		color: var(--ink);
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		font-size: 0.9rem;
		cursor: pointer;
		transition: box-shadow 0.15s var(--ease-out);
	}
	.card:hover,
	.card:focus-visible {
		box-shadow: 0 0 0 1px var(--blood);
		background: #fff;
		color: var(--ink);
	}
	.card.open {
		box-shadow: 0 0 0 2px var(--blood);
	}
	.card.out {
		border-style: dashed;
		opacity: 0.55;
	}
	/* The card's name is its button, stretched over the whole card; the tools sit above it. */
	.card {
		position: relative;
	}
	.opener {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 700;
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
	}
	.opener::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.opener:hover {
		background: none;
		color: var(--blood);
	}
	.opener:focus-visible {
		outline: none;
	}
	.card:has(.opener:focus-visible) {
		box-shadow: 0 0 0 2px var(--blood);
	}
	.card footer,
	.card .kw {
		position: relative;
		z-index: 1;
	}
	.card header {
		min-width: 0;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		align-items: baseline;
	}
	.cost {
		white-space: nowrap;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.meta {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
		text-transform: capitalize;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		min-width: 0;
		margin: 0;
		font-size: 0.8rem;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.stats small {
		margin-right: 2px;
		color: var(--muted);
		text-transform: uppercase;
		font-size: 0.65rem;
	}
	.kw :global(.chip) {
		font-size: 0.62rem;
		padding: 1px 5px;
	}
	.card footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		margin-top: auto;
	}
	.tools {
		display: flex;
		gap: 4px;
		margin-left: auto;
		opacity: 0;
	}
	.card:hover .tools,
	.card:focus-within .tools,
	.card:focus .tools {
		opacity: 1;
	}
	.tick {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--supplies);
	}
	.card.inherited {
		border-top-color: var(--rule);
		background: var(--parchment);
	}
	.tick.inh {
		color: var(--muted);
	}
	.tick.out {
		color: var(--blood);
	}
	.rule .kind {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--blood);
	}
	.rule .body {
		color: var(--ink-soft);
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
		border: 1px dashed var(--rule);
		background: transparent;
		color: var(--blood);
		font-weight: 600;
	}
	.card.new small {
		color: var(--muted);
		font-weight: 400;
		font-size: 0.78rem;
	}
	.mini {
		padding: 1px 7px;
		font-size: 0.68rem;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.drawer {
		position: sticky;
		top: 8px;
		max-height: calc(100dvh - 16px);
		overflow: auto;
		padding: 0 12px 0 14px;
		border-left: 2px solid var(--blood);
		background: var(--paper);
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
	}
	.lib > :global(.library) {
		flex: 1;
		min-height: 0;
	}
	.ok {
		color: var(--supplies);
	}
	.error,
	.danger {
		color: var(--blood);
	}
	/* Narrower: the panel lies over the board, the library goes below it. */
	@media (max-width: 100rem) {
		.boardwrap,
		.boardwrap.withdrawer {
			grid-template-columns: minmax(0, 1fr) minmax(14rem, 17rem);
		}
		.drawer {
			position: fixed;
			z-index: 30;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(36rem, 100vw);
			max-height: none;
		}
	}
	@media (max-width: 48rem) {
		.boardwrap,
		.boardwrap.withdrawer {
			grid-template-columns: minmax(0, 1fr);
		}
		.lib {
			position: static;
			max-height: 26rem;
		}
	}
</style>
