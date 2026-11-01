<!--
  The Add fighter dialog for one group (the group's +): its entries, each with its price, "taken / most" and Recruit,
  or the reasons it cannot be recruited now (the engine's). An entry with upgrades offers them as boxes, one with loadouts
  a choice of loadout; the engine checks them with the recruit, and a refusal shows its reasons in the dialog.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { elementHref } from '#lib/rules/text';
	import type { ApiRecruit } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import { rulesView } from '#lib/ui/rules/context';
	import Dialog from './Dialog.svelte';

	type Props = {
		units: ApiRecruit[];
		/** The group it was opened for (elite, troop, mercenary), or null for every entry. */
		group: string | null;
		beyond: boolean;
		form: FormResult;
		onclose: () => void;
	};
	let { units: all, group, beyond, form, onclose }: Props = $props();
	const units = $derived(
		group && group !== 'special' ? all.filter((u) => u.category === group) : all
	);
	const b = m.warbands.builder;
	const view = rulesView();
	const r = $derived(resultOf(form, 'recruit'));
</script>

<Dialog title={group ? b.addToTitle(b.groups[group] ?? group) : b.addTitle} {onclose}>
	<p class="dim">{b.addHint}</p>
	{#if r.error}<Message kind="danger">{r.error}</Message>{/if}
	<ul>
		{#if !units.length}<li class="none dim">{b.noneToAdd}</li>{/if}
		{#each units as u (u.unitId)}
			<li class:off={!u.ok} data-unit={u.unitId}>
				<div>
					<a href={elementHref(view.set, u.unitId)}>{u.name}</a>
					<span class="dim small"
						>{b.groups[u.category]} · {u.max != null
							? b.usedOf(u.taken, u.max)
							: b.takenAny(u.taken)}</span
					>
					{#if !u.ok}<p class="why">{u.reasons.join('. ')}.</p>{/if}
				</div>
				<span class="data">{m.warbands.price(u.cost, u.currency)}</span>
				<form method="POST" action="?/recruit" use:enhance>
					<input type="hidden" name="op" value="recruit" />
					<input type="hidden" name="unitId" value={u.unitId} />
					{#if u.upgrades.length || u.loadouts.length}
						<div class="picks">
							{#each u.upgrades as up (up.upgradeId)}
								<label class="pick"
									><input type="checkbox" name="up:{up.upgradeId}" />
									{up.name}
									<span class="dim data">{m.warbands.price(up.cost, up.currency)}</span></label
								>
							{/each}
							{#if u.loadouts.length}
								<label class="pick"
									>{b.loadout}
									<select name="loadout">
										<option value="">{b.noLoadout}</option>
										{#each u.loadouts as l, i (i)}<option value={l.lines.join(',')}
												>{l.label}</option
											>{/each}
									</select></label
								>
							{/if}
						</div>
					{/if}
					<Button type="submit" disabled={!u.ok && !beyond}>{b.recruit}</Button>
				</form>
			</li>
		{/each}
	</ul>
</Dialog>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 7rem minmax(0, auto);
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	li a {
		color: var(--bone);
	}
	.off a {
		color: var(--bone-dim);
	}
	.why {
		margin: 0;
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	li > .data {
		text-align: right;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		align-items: center;
		justify-content: flex-end;
	}
	.picks {
		display: grid;
		gap: var(--space-1);
		font-size: var(--size-label);
	}
	.pick {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.pick input[type='checkbox'] {
		accent-color: var(--blood-bright);
	}
	select {
		height: 32px;
		background: var(--inset);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		font: inherit;
	}
	.small {
		font-size: var(--size-label);
	}
</style>
