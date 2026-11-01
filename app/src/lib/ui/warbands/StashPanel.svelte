<!--
  The stash: the banks (Ducats and unspent Glory), the kit held, each with Sell and "Give to" a fighter, and "Buy
  into stash" (a dialog with the warband's armoury).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';

	type Props = { warband: ApiWarband; form: FormResult };
	let { warband: w, form }: Props = $props();
	const b = m.warbands.builder;
	const active = $derived(
		w.fighters
			.filter((x) => x.group !== 'dead')
			.map((x) => ({ value: x.id, label: x.name ?? x.unitName }))
	);
	const error = $derived(resultOf(form, 'stashGive').error ?? resultOf(form, 'stashSell').error);
</script>

<section class="stash">
	<h3>{b.stash}</h3>
	<p class="data banks">
		<span><span class="dim">{b.stashDucats}</span> <strong>{w.stashDucats}</strong></span>
		<span><span class="dim">{b.unspentGlory}</span> <strong>{w.unspentGlory}</strong></span>
	</p>
	{#if error}<Message kind="danger">{error}</Message>{/if}
	{#if w.stash.length}
		<ul>
			{#each w.stash as s, i (i)}
				<li>
					<span>{s.name}</span>
					{#if w.canEdit}
						<form class="give" method="POST" action="?/stashGive" use:enhance>
							<input type="hidden" name="op" value="stashGive" />
							<input type="hidden" name="lineId" value={s.lineId} />
							<label class="visually-hidden" for="give-{i}">{b.giveTo}</label>
							<select id="give-{i}" name="fighterId" disabled={!active.length}>
								{#each active as a (a.value)}<option value={a.value}>{a.label}</option>{/each}
							</select>
							<Button type="submit" disabled={!active.length}>{b.give}</Button>
						</form>
						<form method="POST" action="?/stashSell" use:enhance>
							<input type="hidden" name="op" value="stashSell" />
							<input type="hidden" name="lineId" value={s.lineId} />
							<Button type="submit" kind="danger">{b.sell(s.name)}</Button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="dim">{b.stashEmpty}</p>
	{/if}
	{#if w.canEdit}<div><Button href="?stash" icon={Plus}>{b.stashBuy}</Button></div>{/if}
</section>

<style>
	.stash {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	.banks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.give {
		display: flex;
		gap: var(--space-2);
		margin-left: auto;
	}
	select {
		height: 36px;
		padding: 0 var(--space-2);
		background: var(--inset);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		font: inherit;
	}
</style>
