<script lang="ts">
	import { enhance } from '$app/forms';
	import KeywordChips from './KeywordChips.svelte';
	import { itemFacts, letters, type ArmouryItem, type Check, type HeldItem } from '$lib/warband-rules';

	/**
	 * Trench Companion's "Select Equipment": one armoury category, each item with its cost, how much of its
	 * warband Limit is used and its restrictions. Clicking an item opens its profile; "+ Add Equipment" buys it.
	 * Items the model cannot take stay listed, greyed, with the reason.
	 */
	let {
		open = $bindable(false),
		title,
		items,
		check,
		held,
		unitId,
		glossary,
		rulesText,
		priceOf = (i) => i
	}: {
		open: boolean;
		title: string;
		items: ArmouryItem[];
		check: (i: ArmouryItem) => Check;
		/** Everything the warband holds (models and arsenal), for "Limit: used/max". */
		held: HeldItem[];
		unitId: string;
		glossary: Record<string, string>;
		/** Rule text of an item, when the armoury has it. */
		rulesText: (i: ArmouryItem) => string | null;
		/** What the item costs this model (its entry may price it below the armoury). */
		priceOf?: (i: ArmouryItem) => ArmouryItem;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let chosen = $state<string | null>(null);
	let busy = $state(false);
	let failed = $state<string | null>(null);
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			chosen = null;
			failed = null;
			added = null;
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});
	let added = $state<string | null>(null);
	const allowed = $derived(items.filter((i) => check(i).ok));
	const barred = $derived(items.filter((i) => !check(i).ok));
	/** Buy, then stay open (the list re-checks against the new kit) and say what was added. */
	const buy = (i: ArmouryItem) => () => {
		busy = true;
		failed = null;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: (o: { reset: boolean }) => Promise<void> }) => {
			busy = false;
			if (result.type === 'failure') failed = (result.data?.message as string) ?? 'Could not add it.';
			else {
				added = i.name;
				await update({ reset: false });
			}
		};
	};
	const used = (i: ArmouryItem) => held.filter((h) => letters(h.name) === letters(i.name)).length;
	const hands = (i: ArmouryItem) => {
		const f = itemFacts(i);
		if (!f.hands) return null;
		return `${f.hands} Hand${f.hands > 1 ? 's' : ''}`;
	};
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} class="picker tc" aria-labelledby="equip-title">
	<header>
		<h2 id="equip-title">Select Equipment <small>{title}</small></h2>
		<button type="button" class="x" aria-label="Close" onclick={() => (open = false)}>×</button>
	</header>
	{#snippet row(i: ArmouryItem)}
		{@const c = check(i)}
		{@const p = priceOf(i)}
		<li class:on={chosen === i.name} class:off={!c.ok}>
			<div class="line">
				<button type="button" class="row" aria-expanded={chosen === i.name} onclick={() => (chosen = chosen === i.name ? null : i.name)}>
					<span class="name">{i.name}</span>
					<span class="meta">
						<span class="cost"
							>{#if p.cost !== i.cost || p.currency !== i.currency}<s>{i.cost} {i.currency === 'glory' ? 'G' : 'D'}</s> {/if}{p.cost}
							{p.currency === 'glory' ? 'G' : 'D'}</span
						>
						{#if i.limit != null}<span>Limit: {used(i)}/{i.limit}</span>{/if}
						{#if itemFacts(i).only.length}<span>{itemFacts(i).only.join(', ')} only</span>{/if}
					</span>
				</button>
				{#if c.ok}
					<!-- One tap: buy it for this fighter; the dialog stays open for the next piece. -->
					<form method="POST" action="?/buy" use:enhance={buy(i)} class="quick">
						<input type="hidden" name="item" value={i.id} />
						<button class="plus" name="unit" value={unitId} disabled={busy} aria-label="Add {i.name}" title="Add to this fighter">+</button>
					</form>
				{/if}
			</div>
			{#if !c.ok}<p class="why">{c.reason}</p>{/if}
			{#if chosen === i.name}
				<div class="profile">
					<dl>
						{#if i.range}<dt>Range</dt><dd>{i.range}</dd>{/if}
						{#if hands(i)}<dt>Hands ({i.category === 'melee' ? 'Melee' : 'Ranged'})</dt><dd>{hands(i)}</dd>{/if}
						{#if i.type && !hands(i)}<dt>Type</dt><dd>{i.type}</dd>{/if}
					</dl>
					{#if i.keywords.length}<KeywordChips keywords={i.keywords} {glossary} dark />{/if}
					{#if rulesText(i)}<p class="rules">{rulesText(i)}</p>{/if}
					<form method="POST" action="?/buy" use:enhance={buy(i)}>
						<input type="hidden" name="item" value={i.id} />
						<button class="add stash" name="unit" value="stash" disabled={busy} title="Buy it into the arsenal, to give to a fighter later">Into the Arsenal</button>
					</form>
				</div>
			{/if}
		</li>
	{/snippet}
	<ul>
		{#each allowed as i (i.id ?? i.name)}{@render row(i)}{:else}
			<li class="empty">{items.length ? 'This fighter can take nothing more from here.' : 'Nothing in this part of your armoury.'}</li>
		{/each}
	</ul>
	{#if barred.length}
		<details class="barred">
			<summary>Not for this fighter now ({barred.length})</summary>
			<ul>{#each barred as i (i.id ?? i.name)}{@render row(i)}{/each}</ul>
		</details>
	{/if}
	{#if added}<p class="added" role="status">Added {added}.</p>{/if}
	{#if failed}<p class="why" role="alert">{failed}</p>{/if}
	<footer><button type="button" class="cancel" onclick={() => (open = false)}>Done</button></footer>
</dialog>

<style>
	.picker {
		width: min(34rem, calc(100vw - 24px));
		max-height: min(80vh, 46rem);
		padding: 0;
		border: 0;
		background: #26231e;
		color: var(--bone);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	.line {
		display: flex;
		align-items: stretch;
	}
	.line .row {
		flex: 1;
	}
	.quick {
		display: flex;
	}
	.plus {
		width: 3rem;
		border: 0;
		background: #b3261e;
		color: var(--bone);
		font-size: 1.4rem;
		cursor: pointer;
	}
	.plus:hover {
		background: #cf3326;
	}
	.barred summary {
		padding: 8px 14px;
		cursor: pointer;
		opacity: 0.8;
	}
	.added {
		margin: 8px 14px;
		color: #9fc58a;
	}
	.picker::backdrop {
		background: rgba(10, 8, 6, 0.6);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: #8f1f18;
		position: sticky;
		top: 0;
		z-index: 1;
	}
	h2 {
		margin: 0;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.2rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	h2 small {
		font-weight: 400;
		opacity: 0.75;
		margin-left: 6px;
	}
	.x {
		background: none;
		border: 0;
		color: var(--bone);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		border-bottom: 1px solid rgba(236, 229, 211, 0.08);
	}
	.row {
		text-transform: none;
		letter-spacing: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 14px;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	li.on .row {
		background: #8f1f18;
	}
	.row:hover {
		background: rgba(236, 229, 211, 0.06);
	}
	li.off .row .name {
		opacity: 0.45;
	}
	.meta {
		display: grid;
		justify-items: end;
		font-size: 0.78rem;
		opacity: 0.85;
		white-space: nowrap;
	}
	.cost {
		font-size: 0.9rem;
		font-weight: 600;
	}
	.why {
		margin: -4px 14px 8px;
		font-size: 0.8rem;
		color: #e0a39a;
	}
	.profile {
		padding: 8px 14px 12px;
		background: rgba(0, 0, 0, 0.18);
		display: grid;
		gap: 8px;
	}
	dl {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin: 0;
		font-size: 0.88rem;
	}
	dt,
	dd {
		margin: 0;
		padding: 4px 0;
		border-bottom: 1px solid rgba(236, 229, 211, 0.08);
	}
	.rules {
		margin: 0;
		font-size: 0.88rem;
		color: var(--bone-dim);
	}
	.add {
		width: 100%;
		padding: 7px;
		background: #b3261e;
		color: var(--bone);
		border: 0;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.add.stash {
		margin-top: 6px;
		background: transparent;
		border: 1px solid #b3261e;
	}
	.add:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.empty {
		padding: 14px;
		opacity: 0.7;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		padding: 10px 14px;
		position: sticky;
		bottom: 0;
		background: #26231e;
	}
	.cancel {
		padding: 6px 14px;
		background: #5a5650;
		color: var(--bone);
		border: 0;
		font: inherit;
		cursor: pointer;
	}
</style>
