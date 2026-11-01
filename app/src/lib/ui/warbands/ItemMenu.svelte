<!--
  The ⋮ menu of one piece of bought kit, on a fighter or in the Arsenal (the book's Quartermaster rules): move it to
  another fighter or the Arsenal (no money), sell it for half its price (rounded up, in its own currency), refund it
  in full (only before the warband's first game), buy another copy, or delete it (nothing back).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { Price } from '#lib/warbands/types';
	import Menu from './Menu.svelte';

	type Props = {
		/** Who holds it: a fighter's id, or the Arsenal. */
		from: string;
		lineId: string;
		name: string;
		/** Its value now: a refund gives this back. */
		price: Price;
		sell: Price;
		/** What a copy costs. */
		buy: Price;
		canRefund: boolean;
		/** Where it may move to (the other fighters on the roster, and the Arsenal). */
		holders: { id: string; label: string }[];
	};
	let { from, lineId, name, price, sell, buy, canRefund, holders }: Props = $props();
	const b = m.warbands.builder;
	const money = (p: Price) => m.warbands.money(p.ducats, p.glory);
	let to = $state('');
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<Menu label={b.itemMenu(name)}>
	{#if holders.length}
		<form class="move" method="POST" action="?/move" use:enhance={keep}>
			<input type="hidden" name="op" value="move" />
			<input type="hidden" name="id" value={from} />
			<input type="hidden" name="lineId" value={lineId} />
			<input type="hidden" name="from" value={from} />
			<label
				><span class="visually-hidden">{b.moveTo}</span>
				<select name="to" bind:value={to} aria-label={b.moveTo}>
					<option value="" disabled>{b.moveTo}</option>
					{#each holders as h (h.id)}<option value={h.id}>{h.label}</option>{/each}
				</select></label
			>
			<button type="submit" disabled={!to}>{b.move}</button>
		</form>
	{/if}
	{#each [{ mode: 'sell', label: b.sellHalf, note: money(sell), off: false }, { mode: 'refund', label: b.refund, note: canRefund ? money(price) : b.refundClosed, off: !canRefund }, { mode: 'delete', label: b.deleteItem, note: b.nothingBack, off: false }] as a (a.mode)}
		<form method="POST" action="?/leave" use:enhance>
			<input type="hidden" name="op" value="leave" />
			<input type="hidden" name="id" value={from} />
			<input type="hidden" name="from" value={from} />
			<input type="hidden" name="lineId" value={lineId} />
			<input type="hidden" name="mode" value={a.mode} />
			<button type="submit" disabled={a.off} data-mode={a.mode}
				>{a.label} <small>{a.note}</small></button
			>
		</form>
	{/each}
	<form method="POST" action={from === 'arsenal' ? '?/stashBuy' : '?/buy'} use:enhance>
		<input type="hidden" name="op" value={from === 'arsenal' ? 'stashBuy' : 'buy'} />
		<input type="hidden" name="id" value={lineId} />
		<input type="hidden" name="lineId" value={lineId} />
		{#if from !== 'arsenal'}<input type="hidden" name="fid" value={from} />{/if}
		<button type="submit">{b.copyItem} <small>{b.pays(money(buy))}</small></button>
	</form>
</Menu>

<style>
	.move {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-2) var(--space-3);
	}
	.move label {
		flex: 1;
	}
	.move select {
		width: 100%;
		height: 30px;
		background: var(--inset);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		font: inherit;
	}
	.move button {
		width: auto;
		padding: var(--space-1) var(--space-2);
		border: var(--border-hairline) solid var(--rule-strong);
	}
</style>
