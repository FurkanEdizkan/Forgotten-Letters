<script lang="ts">
	/**
	 * A unit as a card on the board, in Trench Companion's dark sheet: picture, name and cost, profile boxes,
	 * keywords, abilities and the kit it always has. Every value is edited where it stands (each change is saved
	 * on its own); armoury cards dropped on its kit join it, keywords dropped on its keywords too.
	 */
	import { accepts, drag, endDrag, startDrag } from '$lib/components/drag.svelte';
	import CardKeywords from './CardKeywords.svelte';

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
	let {
		u,
		fixed,
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
		u: Unit;
		fixed: string[];
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

	const STATS = [
		['movement', 'Movement'],
		['melee', 'Melee'],
		['ranged', 'Ranged'],
		['armour', 'Armour']
	] as const;
	const initials = (n: string) =>
		n
			.split(/\s+/)
			.filter((w) => /^[A-Z]/.test(w))
			.slice(0, 2)
			.map((w) => w[0])
			.join('') || n[0];
	let kitOver = $state(false);
	let adding = $state(false);
	/** An armoury card's name (a board item card, or kit from the library); not a unit's. */
	const itemName = (v: unknown) => (v && typeof v === 'object' && 'name' in v && (v as { kind?: string; adopt?: string }).kind !== 'unit' && (v as { adopt?: string }).adopt !== 'unit' ? String((v as { name: string }).name) : null);
	const ro = $derived(inherited);
</script>

<article class="ucard" class:out class:open class:inherited>
	<header>
		<span class="handle" draggable="true" role="presentation" title="Drag to reorder" {ondragstart} ondragend={endDrag}>⠿</span>
		<div class="pic" aria-hidden="true">{initials(u.name)}</div>
		<div class="title">
			<input class="f name" value={u.name} readonly={ro} aria-label="Name" onchange={(e) => patch({ name: e.currentTarget.value })} />
			<div class="sub">
				<select class="f" value={u.category} disabled={ro} aria-label="Kind" onchange={(e) => patch({ category: e.currentTarget.value })}>
					<option value="elite">Elite</option><option value="troop">Troop</option><option value="mercenary">Mercenary</option>
				</select>
				<input class="f n" type="number" min="0" value={u.availabilityMin} readonly={ro} aria-label="At least" onchange={(e) => patch({ min: e.currentTarget.value })} />–<input
					class="f n"
					type="number"
					min="0"
					value={u.availabilityMax ?? ''}
					placeholder="any"
					readonly={ro}
					aria-label="At most"
					onchange={(e) => patch({ max: e.currentTarget.value })}
				/>
			</div>
		</div>
		<div class="cost">
			<input class="f n" type="number" min="0" value={u.cost} readonly={ro} aria-label="Cost" onchange={(e) => patch({ cost: e.currentTarget.value })} />
			<select class="f" value={u.currency} disabled={ro} aria-label="Paid in" onchange={(e) => patch({ currency: e.currentTarget.value })}>
				<option value="ducats">D</option><option value="glory">G</option>
			</select>
		</div>
	</header>

	<div class="stats">
		{#each STATS as [k, label] (k)}
			<label><small>{label}</small><input class="box" value={String(u.stats[k] ?? '')} readonly={ro} onchange={(e) => patch({ stats: { [k]: e.currentTarget.value } })} /></label>
		{/each}
	</div>

	{#if ro}
		<p class="kwro">{u.keywords.join(' · ')}</p>
	{:else}
		<CardKeywords keywords={u.keywords} {glossary} onchange={(k) => patch({ keywords: k })} />
	{/if}

	<div class="abilities">
		{#each u.abilities as a, i (i)}
			<div class="ab">
				<input class="f abname" value={a.name} readonly={ro} aria-label="Ability name" onchange={(e) => patch({ abilities: u.abilities.map((x, j) => (j === i ? { ...x, name: e.currentTarget.value } : x)) })} />
				<textarea class="f" value={a.text} readonly={ro} aria-label="{a.name}: text" onchange={(e) => patch({ abilities: u.abilities.map((x, j) => (j === i ? { ...x, text: e.currentTarget.value } : x)) })}></textarea>
				{#if !ro}<button type="button" class="x" aria-label="Remove {a.name}" onclick={() => patch({ abilities: u.abilities.filter((_, j) => j !== i) })}>×</button>{/if}
			</div>
		{/each}
		{#if adding}
			<div class="ab">
				<!-- svelte-ignore a11y_autofocus -->
				<input class="f abname" placeholder="Ability name" autofocus onchange={(e) => (patch({ abilities: [...u.abilities, { name: e.currentTarget.value, text: '' }] }), (adding = false))} />
			</div>
		{:else if !ro}
			<button type="button" class="more" onclick={() => (adding = true)}>+ ability</button>
		{/if}
	</div>

	<div
		class="kit"
		class:over={kitOver}
		role="group"
		aria-label="Always has"
		ondragover={(e) => !ro && itemName(drag.value) && (drag.kind === 'row' || drag.kind === 'item') && (e.preventDefault(), (kitOver = true))}
		ondragleave={() => (kitOver = false)}
		ondrop={(e) => {
			const n = itemName(drag.value);
			if (ro || !n) return;
			e.preventDefault();
			e.stopPropagation();
			kitOver = false;
			if (!fixed.includes(n)) patch({ fixed: [...fixed, n] });
			endDrag();
		}}
	>
		<small>Always has</small>
		{#each fixed as f (f)}
			<span class="kitchip">{f}{#if !ro}<button type="button" aria-label="Remove {f}" onclick={() => patch({ fixed: fixed.filter((x) => x !== f) })}>×</button>{/if}</span>
		{:else}
			<span class="hint">{ro ? 'nothing' : 'drop armoury cards here'}</span>
		{/each}
	</div>

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
	.ucard {
		display: grid;
		gap: 8px;
		padding: 10px 12px 8px;
		background: #2a2824;
		border: 1px solid rgba(236, 229, 211, 0.1);
		border-top: 3px solid var(--blood);
		color: var(--bone);
		font-size: 0.88rem;
	}
	.ucard.open {
		box-shadow: 0 0 0 2px var(--blood-bright);
	}
	.ucard.out {
		opacity: 0.5;
		border-style: dashed;
	}
	.ucard.inherited {
		background: #23211d;
		border-top-color: rgba(236, 229, 211, 0.25);
	}
	header {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		gap: 8px;
		align-items: start;
	}
	.handle {
		color: var(--bone-dim);
		cursor: grab;
		user-select: none;
		padding-top: 4px;
	}
	.pic {
		display: grid;
		place-items: center;
		width: 3.4rem;
		height: 3.4rem;
		background: #3a3731;
		color: var(--bone);
		font-family: var(--font-display, serif);
		font-size: 1.5rem;
	}
	.title {
		min-width: 0;
	}
	.sub,
	.cost {
		display: flex;
		align-items: center;
		gap: 2px;
		color: var(--bone-dim);
	}
	/* Values read as text until hovered or focused, then as fields. */
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
		padding-right: 3px;
	}
	select.f option {
		color: var(--ink);
	}
	.name {
		width: 100%;
		font-size: 1.05rem;
		font-weight: 700;
	}
	.n {
		width: 3.2rem;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.cost .n {
		width: 3.6rem;
		text-align: right;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--bone);
	}
	.stats {
		display: grid;
		grid-template-columns: 1.4fr 1fr 1fr 1fr;
		gap: 4px;
	}
	.stats label {
		display: grid;
		gap: 2px;
		text-align: center;
	}
	.stats small {
		font-size: 0.7rem;
		color: var(--bone-dim);
	}
	.box {
		width: 100%;
		box-sizing: border-box;
		padding: 5px 2px;
		background: #3a3731;
		border: 1px solid transparent;
		color: var(--bone);
		text-align: center;
		font-weight: 600;
	}
	.box:focus {
		border-color: var(--bone-dim);
		box-shadow: none;
	}
	.kwro {
		margin: 0;
		color: var(--bone-dim);
		font-size: 0.8rem;
	}
	.abilities {
		display: grid;
		gap: 4px;
	}
	.ab {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 4px;
	}
	.abname {
		font-weight: 700;
		color: var(--blood-pale);
	}
	.ab textarea {
		grid-column: 1;
		field-sizing: content;
		min-height: 1.6em;
		resize: none;
		font-size: 0.84rem;
		line-height: 1.4;
		color: var(--bone);
	}
	.x {
		grid-row: 1;
		grid-column: 2;
		padding: 0 5px;
		border: 0;
		background: none;
		color: var(--bone-dim);
	}
	.more {
		justify-self: start;
		padding: 1px 6px;
		border: 1px dashed rgba(236, 229, 211, 0.25);
		background: none;
		color: var(--bone-dim);
		font-size: 0.75rem;
	}
	.kit {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
		padding: 6px;
		background: rgba(0, 0, 0, 0.2);
		min-height: 2rem;
	}
	.kit.over {
		outline: 2px dashed var(--blood-bright);
	}
	.kit small {
		margin-right: 4px;
		color: var(--bone-dim);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.kitchip {
		display: inline-flex;
		align-items: center;
		padding: 1px 2px 1px 7px;
		background: #3a3731;
		font-size: 0.8rem;
	}
	.kitchip button {
		padding: 0 5px;
		border: 0;
		background: none;
		color: var(--bone-dim);
	}
	.hint {
		color: var(--bone-dim);
		font-size: 0.78rem;
		font-style: italic;
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
