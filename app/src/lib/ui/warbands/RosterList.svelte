<!--
  The builder's fighter lists: Elites, Troops, Mercenaries and Special, each with a + that opens its Add dialog,
  then Dead and departed (fighters whose status took them off the roster). A row shows the picture slot, name and
  entry, cost, a kit summary and a ⋮ menu (copy, refund before the first game, delete); clicking it opens the
  fighter's panel on the right.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import type { ApiFighter, ApiWarband } from '#lib/schemas/warbands';
	import { isActive } from '#lib/warbands/types';
	import Menu from './Menu.svelte';

	type Props = { warband: ApiWarband; sel: string };
	let { warband: wb, sel }: Props = $props();
	const b = m.warbands.builder;
	const LISTS = ['elite', 'troop', 'mercenary', 'special'] as const;
	const lists = $derived([
		...LISTS.map((g) => ({
			g,
			add: true,
			list: wb.fighters.filter((x) => isActive(x) && x.group === g)
		})),
		{ g: 'dead', add: false, list: wb.fighters.filter((x) => !isActive(x)) }
	]);
	const kitOf = (x: ApiFighter) => x.kit.map((k) => k.name).join(', ');
</script>

{#each lists as { g, add, list } (g)}
	{#if add || list.length}
		<section class="group" data-group={g}>
			<h2 class="gh">
				{b.groups[g]}
				<span class="n data">{list.length}</span>
				{#if add && wb.canEdit}
					<a class="plus" href="?sel={sel}&add={g}" aria-label={b.addTo(b.groups[g]!)}
						><Plus size={18} aria-hidden={true} /></a
					>
				{/if}
			</h2>
			{#each list as x (x.id)}
				<div class="row" class:on={sel === x.id} data-fighter={x.id}>
					<a class="open" href="?sel={x.id}">
						<span class="th" class:has={!!x.image}
							>{#if x.image}<img src={x.image} alt="" />{/if}</span
						>
						<span class="who">
							<b>{x.name ?? x.unitName}</b>
							{#if x.name}<span class="t">{x.unitName}</span>{/if}
							{#if x.status !== 'active'}<span class="st">{b.statuses[x.status]}</span>{/if}
						</span>
						<span class="c data">{m.warbands.money(x.cost.ducats, x.cost.glory)}</span>
						<span class="k">{kitOf(x) || b.noKit}</span>
					</a>
					{#if wb.canEdit}
						<Menu label={b.fighterMenu(x.name ?? x.unitName)}>
							<form method="POST" action="?/copyFighter" use:enhance>
								<input type="hidden" name="op" value="copyFighter" />
								<input type="hidden" name="fid" value={x.id} />
								<button type="submit"
									>{b.copyFighter}
									<small>{b.pays(m.warbands.money(x.cost.ducats, x.cost.glory))}</small></button
								>
							</form>
							{#each [{ mode: 'refund', label: b.refund, note: wb.canRefund ? m.warbands.money(x.cost.ducats, x.cost.glory) : b.refundClosed, off: !wb.canRefund }, { mode: 'delete', label: b.deleteFighter, note: b.nothingBack, off: false }] as a (a.mode)}
								<form method="POST" action="?/removeFighter" use:enhance>
									<input type="hidden" name="op" value="removeFighter" />
									<input type="hidden" name="fid" value={x.id} />
									<input type="hidden" name="mode" value={a.mode} />
									<button type="submit" disabled={a.off} data-mode={a.mode}
										>{a.label} <small>{a.note}</small></button
									>
								</form>
							{/each}
						</Menu>
					{/if}
				</div>
			{:else}
				<p class="none dim">{b.noneYet}</p>
			{/each}
		</section>
	{/if}
{/each}

<style>
	.group {
		display: grid;
	}
	.gh {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		padding: var(--space-1) var(--space-3);
		background: var(--blood);
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.n {
		opacity: 0.8;
		letter-spacing: 0;
	}
	.plus {
		display: grid;
		place-items: center;
		margin-left: auto;
		width: 26px;
		height: 26px;
		color: var(--bone);
	}
	.plus:hover {
		background: var(--blood-bright);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		background: var(--panel);
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.row.on {
		background: color-mix(in srgb, var(--blood) 45%, var(--panel));
	}
	.open {
		display: grid;
		grid-template-columns: 2.4rem minmax(0, 1fr) auto;
		gap: 0 var(--space-3);
		align-items: center;
		padding: var(--space-2) var(--space-3);
		color: var(--bone);
		text-decoration: none;
	}
	.row:hover:not(.on) {
		background: var(--panel-hover);
	}
	.th {
		grid-row: span 2;
		aspect-ratio: 3 / 4;
		border: var(--border-hairline) dashed var(--rule-strong);
		background: var(--inset);
		overflow: hidden;
	}
	.th.has {
		border-style: solid;
	}
	.th img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.who b {
		font-weight: 600;
	}
	.t,
	.st {
		margin-left: var(--space-2);
		color: var(--bone-dim);
	}
	.st {
		color: var(--warn);
		font-size: var(--size-label);
	}
	.c {
		text-align: right;
	}
	.k {
		grid-column: 2 / 4;
		overflow: hidden;
		color: var(--bone-dim);
		font-size: var(--size-label);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.none {
		max-width: none;
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: var(--panel);
		font-size: var(--size-label);
	}
</style>
