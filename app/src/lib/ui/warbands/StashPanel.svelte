<!--
  The Arsenal panel (the warband's stash, Rulebook Quartermaster): the strongbox (Ducats and Glory, with Edit), the
  value of the items it holds, and the items by category (exploration finds apart), each category with + to buy
  straight into it and each item with its ⋮ menu (move to a fighter, sell at half, refund before the first game,
  copy, delete). Limits count Arsenal copies with the ones on fighters.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import { peek } from '#lib/ui/rules/peek.svelte';
	import { elementHref } from '#lib/rules/text';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import { rulesView } from '#lib/ui/rules/context';
	import ItemMenu from './ItemMenu.svelte';

	type Props = { warband: ApiWarband; holders: { id: string; label: string }[]; form: FormResult };
	let { warband: wb, holders, form }: Props = $props();
	const b = m.warbands.builder;
	const view = rulesView();
	const CATS = ['ranged', 'melee', 'grenade', 'armour', 'shield', 'equipment', 'special'];
	let editing = $state(false);
	const patch = $derived(resultOf(form, 'patch'));
	const left = $derived(resultOf(form, 'leave', 'arsenal'));
	const moved = $derived(resultOf(form, 'move', 'arsenal'));
	const value = $derived(
		wb.stash.reduce(
			(t, s) => ({ ducats: t.ducats + s.price.ducats, glory: t.glory + s.price.glory }),
			{ ducats: 0, glory: 0 }
		)
	);
	const groups = $derived([
		...CATS.map((c) => ({
			c,
			label: b.categories[c] ?? c,
			list: wb.stash.filter((s) => !s.exploration && s.category === c)
		})),
		{ c: 'exploration', label: b.explorationItems, list: wb.stash.filter((s) => s.exploration) }
	]);
	$effect(() => {
		if (patch.done) editing = false;
	});
</script>

<article class="panel" data-panel="arsenal">
	<header class="pnh">
		<a class="back" href="?sel=warband" aria-label={b.backToWarband}>‹</a>
		<h2>{b.arsenal}</h2>
	</header>
	<div class="pnb">
		<div class="kv">
			<span>{b.strongbox}</span>
			<b class="data">{m.warbands.money(wb.stashDucats, wb.unspentGlory)}</b>
			{#if wb.canEdit && !editing}<Button onclick={() => (editing = true)}>{b.edit}</Button>{/if}
		</div>
		{#if editing}
			<form
				class="edit"
				method="POST"
				action="?/patch"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="op" value="patch" />
				<input type="hidden" name="version" value={wb.version} />
				<Field
					label={b.stashDucats}
					name="stashDucats"
					type="number"
					value={String(wb.stashDucats)}
					error={patch.fields.stashDucats}
				/>
				<Field
					label={b.unspentGlory}
					name="unspentGlory"
					type="number"
					value={String(wb.unspentGlory)}
					error={patch.fields.unspentGlory}
				/>
				<div class="row">
					<Button kind="primary" type="submit">{b.save}</Button>
					<Button onclick={() => (editing = false)}>{m.warbands.wizard.cancel}</Button>
				</div>
			</form>
		{/if}
		<div class="kv">
			<span>{b.itemsValue}</span><span class="data"
				>{m.warbands.money(value.ducats, value.glory)}</span
			>
		</div>
		{#each groups as g (g.c)}
			<div class="cat">
				{g.label}
				{#if wb.canEdit && g.c !== 'exploration'}<a
						class="plus"
						href="?sel=arsenal&stash={g.c}"
						aria-label={b.buyCat(g.label)}><Plus size={16} aria-hidden={true} /></a
					>{/if}
			</div>
			{#each g.list as s, i (`${i}:${s.lineId}`)}
				<div class="it" data-stash={s.lineId}>
					<a href={elementHref(view.set, s.itemId)} use:peek={s.itemId}>{s.name}</a>
					<span class="c data">{m.warbands.money(s.price.ducats, s.price.glory)}</span>
					{#if wb.canEdit}
						<ItemMenu
							from="arsenal"
							lineId={s.lineId}
							name={s.name}
							price={s.price}
							sell={s.sell}
							buy={s.buy}
							canRefund={wb.canRefund}
							holders={holders.filter((h) => h.id !== 'arsenal')}
						/>
					{/if}
				</div>
			{:else}
				<p class="none">{b.noneYet}</p>
			{/each}
		{/each}
		{#if left.error || moved.error}<Message kind="danger">{left.error ?? moved.error}</Message>{/if}
		<p class="note">{b.arsenalRules}</p>
	</div>
</article>

<style>
	.panel {
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.pnh {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) var(--space-4);
		background: var(--blood);
	}
	.pnh h2 {
		margin: 0;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-title);
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
	}
	.back {
		color: var(--bone);
		text-decoration: none;
		font-size: 1.4em;
		line-height: 1;
	}
	.pnb {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4) var(--space-4);
	}
	.kv {
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr) auto;
		gap: var(--space-3);
		align-items: center;
	}
	.kv > span:first-child {
		color: var(--bone-faint);
	}
	.edit {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--inset);
	}
	.row {
		grid-column: 1 / -1;
		display: flex;
		gap: var(--space-2);
	}
	.cat {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		padding: 2px var(--space-2);
		background: var(--inset);
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.plus {
		display: grid;
		place-items: center;
		margin-left: auto;
		color: var(--bone);
	}
	.it {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: 2px var(--space-2);
	}
	.it a {
		color: var(--bone);
	}
	.c {
		margin-left: auto;
	}
	.none,
	.note {
		margin: 0;
		padding: 0 var(--space-2);
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
	.note {
		margin-top: var(--space-3);
	}
</style>
