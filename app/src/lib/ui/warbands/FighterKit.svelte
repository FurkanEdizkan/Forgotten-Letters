<!--
  A fighter's upgrades and Battlekit, on its panel: each upgrade as a switch with its price, "taken / most" and its
  text (and why it cannot be taken now); then the armoury sentence and the Battlekit by category, each category with
  + (the equip picker) and each bought piece with its price and ⋮ menu (move, sell, refund, copy, delete).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import { peek } from '#lib/ui/rules/peek.svelte';
	import { elementHref } from '#lib/rules/text';
	import type { Unit } from '#lib/rules/pack';
	import type { ApiFighter, ApiUpgrade } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import { rulesView } from '#lib/ui/rules/context';
	import ItemMenu from './ItemMenu.svelte';

	type Props = {
		fighter: ApiFighter;
		unit?: Unit;
		upgrades: ApiUpgrade[];
		holders: { id: string; label: string }[];
		canEdit: boolean;
		canRefund: boolean;
		beyond: boolean;
		form: FormResult;
	};
	let { fighter: x, unit, upgrades, holders, canEdit, canRefund, beyond, form }: Props = $props();
	const b = m.warbands.builder;
	const view = rulesView();
	const CATS = ['ranged', 'melee', 'grenade', 'armour', 'shield', 'equipment', 'special'];
	const left = $derived(resultOf(form, 'leave', x.id));
	const moved = $derived(resultOf(form, 'move', x.id));
	const kitBy = $derived(
		CATS.map((c) => ({ c, list: x.kit.filter((k) => k.category === c) })).filter(
			(g) =>
				g.list.length ||
				(canEdit && !unit?.kit.nothingElse && !unit?.kit.except?.includes(g.c as never))
		)
	);
	const armourySay = $derived(
		unit?.kit.nothingElse
			? b.kitNothingElse
			: unit?.kit.except?.length
				? b.kitExcept(unit.kit.except.map((c) => b.categories[c] ?? c).join(', '))
				: b.kitAny
	);
</script>

{#if upgrades.length}
	<h3 class="sub">{b.upgrades}</h3>
	{#each upgrades as u (u.upgradeId)}
		{@const r = resultOf(form, u.has ? 'removeUpgrade' : 'upgrade', u.upgradeId)}
		<div class="upg" data-upgrade={u.upgradeId}>
			<form method="POST" action={u.has ? '?/removeUpgrade' : '?/upgrade'} use:enhance>
				<input type="hidden" name="op" value={u.has ? 'removeUpgrade' : 'upgrade'} />
				<input type="hidden" name="id" value={u.upgradeId} />
				<input type="hidden" name="fid" value={x.id} />
				<input type="hidden" name="upgradeId" value={u.upgradeId} />
				<button
					class="bx"
					class:on={u.has}
					type="submit"
					role="switch"
					aria-checked={u.has}
					aria-label={u.name}
					disabled={!canEdit || (!u.has && !u.ok && !beyond)}
				></button>
			</form>
			<details>
				<summary
					>{u.name}
					<span class="n data"
						>{m.warbands.price(u.cost, u.currency)}{u.max != null
							? ` · ${u.taken} / ${u.max}`
							: ''}</span
					></summary
				>
				{#if u.text}<p class="dim">{u.text}</p>{/if}
				{#if !u.ok && !u.has}<p class="why">{u.reasons.join('. ')}.</p>{/if}
			</details>
			{#if r.error}<p class="err" role="alert">{r.error}</p>{/if}
		</div>
	{/each}
{/if}

<h3 class="sub">{b.battlekit}</h3>
<p class="arm">{armourySay}</p>
{#each kitBy as { c, list } (c)}
	<div class="cat">
		{b.categories[c] ?? c}
		{#if canEdit}<a
				class="plus"
				href="?sel={x.id}&equip={x.id}&cat={c}"
				aria-label={b.buyCat(b.categories[c] ?? c)}><Plus size={16} aria-hidden={true} /></a
			>{/if}
	</div>
	{#each list as k, i (`${i}:${k.lineId ?? k.itemId}`)}
		<div class="it" data-kit={k.lineId ?? k.itemId}>
			<a href={elementHref(view.set, k.itemId)} use:peek={k.itemId}>{k.name}</a>
			{#if k.fixed}<span class="dim">{b.fixed}</span>{/if}
			<span class="c data">{k.fixed ? '' : m.warbands.money(k.price.ducats, k.price.glory)}</span>
			{#if canEdit && k.lineId && !k.fixed}
				<ItemMenu
					from={x.id}
					lineId={k.lineId}
					name={k.name}
					price={k.price}
					sell={k.sell}
					buy={k.buy}
					{canRefund}
					{holders}
				/>
			{/if}
		</div>
	{/each}
{/each}
{#if left.error || moved.error}<p class="err" role="alert">{left.error ?? moved.error}</p>{/if}

<style>
	.sub {
		display: flex;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding-bottom: 2px;
		border-bottom: var(--border-hairline) solid var(--blood);
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.upg {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0 var(--space-2);
		align-items: start;
	}
	.upg .err {
		grid-column: 2;
	}
	.bx {
		width: 18px;
		height: 18px;
		margin-top: 3px;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		cursor: pointer;
	}
	.bx.on {
		background: var(--blood);
		border-color: var(--blood-bright);
	}
	.bx:disabled {
		cursor: default;
		opacity: 0.5;
	}
	summary {
		cursor: pointer;
	}
	.n {
		margin-left: var(--space-2);
		color: var(--bone-dim);
	}
	.why,
	.arm {
		margin: 0;
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
	.arm {
		font-style: italic;
	}
	.cat {
		display: flex;
		align-items: center;
		gap: var(--space-2);
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
	.it .c {
		margin-left: auto;
	}
	.err {
		margin: 0;
		color: var(--danger);
	}
</style>
