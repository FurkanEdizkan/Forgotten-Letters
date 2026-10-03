<script lang="ts">
	/** An armoury item as a card on the board, edited where it stands; drag it by its handle onto a unit's kit. */
	import { endDrag } from '$lib/components/drag.svelte';
	import Mark, { type MarkName } from '$lib/components/Mark.svelte';
	import CardKeywords from './CardKeywords.svelte';

	type Item = { id: string; name: string; category: string; cost: number; currency: string; limit: number | null; keywords: string[]; unique: boolean; type: string | null; range: string | null; text: string | null };
	let {
		it,
		glossary,
		tag,
		out,
		open,
		inherited = false,
		patch,
		onmore,
		ondragstart,
		children
	}: {
		it: Item;
		glossary: Record<string, string>;
		tag: string;
		out: boolean;
		open: boolean;
		inherited?: boolean;
		patch: (p: Record<string, unknown>) => void;
		onmore: () => void;
		ondragstart: (e: DragEvent) => void;
		children?: import('svelte').Snippet;
	} = $props();
	const MARK: Record<string, MarkName> = { ranged: 'ranged', grenade: 'ranged', melee: 'melee', armour: 'armour', shield: 'armour', equipment: 'equipment', special: 'equipment' };
	const CAT: Record<string, string> = { ranged: 'Ranged Weapon', grenade: 'Grenade', melee: 'Melee Weapon', armour: 'Armour', shield: 'Shield', equipment: 'Equipment', special: 'Special' };
	const ro = $derived(inherited);
</script>

<article class="icard" class:out class:open class:inherited>
	<header>
		<span class="handle" draggable="true" role="presentation" title="Drag to reorder, or onto a unit's kit" {ondragstart} ondragend={endDrag}>⠿</span>
		<span class="mark"><Mark name={MARK[it.category] ?? 'equipment'} /></span>
		<input class="f name" value={it.name} readonly={ro} aria-label="Name" onchange={(e) => patch({ name: e.currentTarget.value })} />
		<span class="cost">
			<input class="f n" type="number" min="0" value={it.cost} readonly={ro} aria-label="Cost" onchange={(e) => patch({ cost: e.currentTarget.value })} />
			<select class="f" value={it.currency} disabled={ro} aria-label="Paid in" onchange={(e) => patch({ currency: e.currentTarget.value })}>
				<option value="ducats">D</option><option value="glory">G</option>
			</select>
		</span>
	</header>
	<div class="facts">
		<span>{CAT[it.category] ?? it.category}{it.type ? ` · ${it.type}` : ''}</span>
		<label>Range <input class="f r" value={it.range ?? ''} placeholder="—" readonly={ro} onchange={(e) => patch({ range: e.currentTarget.value })} /></label>
		<label>Limit <input class="f n" type="number" min="0" value={it.limit ?? ''} placeholder="—" readonly={ro} onchange={(e) => patch({ limit: e.currentTarget.value })} /></label>
	</div>
	{#if ro}
		<p class="kwro">{it.keywords.join(' · ')}</p>
	{:else}
		<CardKeywords keywords={it.keywords} {glossary} onchange={(k) => patch({ keywords: k })} />
	{/if}
	<textarea class="f text" value={it.text ?? ''} placeholder={ro ? '' : 'Its rules…'} readonly={ro} aria-label="Rules" onchange={(e) => patch({ text: e.currentTarget.value })}></textarea>
	<footer>
		{#if tag}<span class="tag">{tag}</span>{/if}
		{#if out}<span class="tag out">excluded</span>{/if}
		<span class="tools">
			{@render children?.()}
			{#if !ro}<button type="button" class="ghost mini" onclick={onmore}>More…</button>{/if}
		</span>
	</footer>
</article>

<style>
	.icard {
		display: grid;
		gap: 6px;
		padding: 8px 12px;
		background: #2a2824;
		border: 1px solid rgba(236, 229, 211, 0.1);
		border-left: 3px solid #5a564d;
		color: var(--bone);
		font-size: 0.86rem;
	}
	.icard.open {
		box-shadow: 0 0 0 2px var(--blood-bright);
	}
	.icard.out {
		opacity: 0.5;
		border-style: dashed;
	}
	.icard.inherited {
		background: #23211d;
	}
	header {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		gap: 6px;
		align-items: center;
	}
	.handle {
		color: var(--bone-dim);
		cursor: grab;
		user-select: none;
	}
	.mark {
		color: var(--bone-dim);
	}
	.f {
		min-width: 0;
		padding: 1px 3px;
		border: 1px solid transparent;
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.f:hover:not([readonly]):not(:disabled) {
		border-color: rgba(236, 229, 211, 0.2);
	}
	.f:focus {
		border-color: var(--bone-dim);
		background: rgba(0, 0, 0, 0.25);
		box-shadow: none;
	}
	select.f {
		appearance: none;
	}
	select.f option {
		color: var(--ink);
	}
	.name {
		width: 100%;
		font-weight: 700;
		font-size: 0.98rem;
	}
	.cost {
		display: flex;
		align-items: center;
		color: var(--bone-dim);
	}
	.n {
		width: 3.2rem;
		text-align: right;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.cost .n {
		font-weight: 700;
		color: var(--bone);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		align-items: center;
		color: var(--bone-dim);
		font-size: 0.78rem;
	}
	.facts label {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.r {
		width: 5rem;
		color: var(--bone);
	}
	.facts .n {
		text-align: left;
		color: var(--bone);
	}
	.kwro {
		margin: 0;
		color: var(--bone-dim);
		font-size: 0.8rem;
	}
	.text {
		field-sizing: content;
		min-height: 1.6em;
		max-height: 9em;
		resize: none;
		font-size: 0.8rem;
		line-height: 1.4;
		color: var(--bone);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.tag {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--bone-dim);
	}
	.tag.out {
		color: var(--blood-pale);
	}
	.tools {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	.tools :global(.mini) {
		padding: 1px 8px;
		font-size: 0.68rem;
		letter-spacing: 0.03em;
		white-space: nowrap;
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.25);
	}
	.tools :global(.mini:hover) {
		color: var(--bone);
		border-color: var(--blood-bright);
	}
</style>
