<!--
  The Equip dialog for one fighter: what it carries (fixed kit marked, bought kit with Sell), its upgrades (Take or
  Take off, with the reasons one cannot be taken), and the armoury by category with prices, keyword pop-ups and the
  reasons a line cannot be taken now.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { Item } from '#lib/rules/pack';
	import type { ApiArmouryLine, ApiFighter, ApiUpgrade } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Dialog from './Dialog.svelte';
	import LineList from './LineList.svelte';

	type Props = {
		fighter: ApiFighter;
		armoury: ApiArmouryLine[];
		upgrades: ApiUpgrade[];
		items: Record<string, Item>;
		beyond: boolean;
		form: FormResult;
		onclose: () => void;
	};
	let { fighter: x, armoury, upgrades, items, beyond, form, onclose }: Props = $props();
	const b = m.warbands.builder;
	const sold = $derived(resultOf(form, 'sell', x.id));
	const bought = $derived(x.kit.filter((k) => !k.fixed));
</script>

<Dialog title={b.equipTitle(x.name ?? x.unitName)} {onclose} wide>
	<div class="cols">
		<div class="side">
			<section>
				<h3>{b.owned}</h3>
				<ul class="owned">
					{#each x.kit as k, i (i)}
						<li>
							<span
								>{k.name}{#if k.fixed}<span class="dim"> ({b.fixed})</span>{/if}</span
							>
							{#if !k.fixed && k.lineId}
								<form method="POST" action="?/sell" use:enhance>
									<input type="hidden" name="op" value="sell" />
									<input type="hidden" name="id" value={x.id} />
									<input type="hidden" name="fid" value={x.id} />
									<input type="hidden" name="lineId" value={k.lineId} />
									<Button type="submit" kind="danger">{b.sell(k.name)}</Button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
				{#if !bought.length}<p class="dim">{b.nothingOwned}</p>{/if}
				{#if sold.error}<Message kind="danger">{sold.error}</Message>{/if}
			</section>
			<section>
				<h3>{b.upgradesTitle}</h3>
				{#if !upgrades.length}<p class="dim">{b.noUpgrades}</p>{/if}
				<ul class="owned">
					{#each upgrades as u (u.upgradeId)}
						{@const r =
							resultOf(form, 'upgrade', u.upgradeId).error ??
							resultOf(form, 'removeUpgrade', u.upgradeId).error}
						<li data-upgrade={u.upgradeId}>
							<span
								>{u.name} <span class="data dim">{m.warbands.price(u.cost, u.currency)}</span>
								{#if !u.ok && !u.has}<span class="why">{u.reasons.join('. ')}.</span>{/if}
								{#if r}<span class="why" role="alert">{r}</span>{/if}</span
							>
							<form method="POST" action={u.has ? '?/removeUpgrade' : '?/upgrade'} use:enhance>
								<input type="hidden" name="op" value={u.has ? 'removeUpgrade' : 'upgrade'} />
								<input type="hidden" name="id" value={u.upgradeId} />
								<input type="hidden" name="fid" value={x.id} />
								<input type="hidden" name="upgradeId" value={u.upgradeId} />
								<Button type="submit" disabled={!u.has && !u.ok && !beyond}
									>{u.has ? b.takeOff : b.take}</Button
								>
							</form>
						</li>
					{/each}
				</ul>
			</section>
		</div>
		<section class="armoury">
			<h3>{b.armoury}</h3>
			<LineList lines={armoury} {items} op="buy" fid={x.id} {beyond} {form} />
		</section>
	</div>
</Dialog>

<style>
	.cols {
		display: grid;
		grid-template-columns: minmax(14rem, 2fr) minmax(0, 3fr);
		gap: var(--space-5);
		align-items: start;
	}
	.side,
	section {
		display: grid;
		gap: var(--space-3);
	}
	.armoury {
		max-height: 60vh;
		overflow-y: auto;
		padding-right: var(--space-2);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.owned li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.why {
		display: block;
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>
