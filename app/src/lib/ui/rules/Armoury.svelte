<!-- An armoury by item category: item, price, limit and the restrictions its stipulations name. -->
<script lang="ts">
	import { idsIn } from '#lib/rules/edges';
	import { elementHref } from '#lib/rules/text';
	import type { ArmouryRow } from '#lib/rules/views';
	import { m } from '#lib/messages';
	import BandHeader from '#lib/ui/BandHeader.svelte';
	import KeywordChip from './KeywordChip.svelte';
	import { rulesView } from './context';

	type Props = { groups: { category: string; rows: ArmouryRow[] }[] };
	let { groups }: Props = $props();
	const view = rulesView();

	/** The ids a line's stipulations name, plus its plain switches (consumable, headgear …), in words. */
	function restrictions(row: ArmouryRow) {
		const s = row.line.stipulations;
		if (!s) return { names: [], flags: [] };
		return {
			names: [...idsIn(s)].map((id) => ({ id, name: view.names[id]?.name ?? id })),
			flags: Object.entries(s)
				.filter(([, v]) => v === true || typeof v === 'number')
				.map(([k, v]) => (v === true ? k : `${k} ${v}`))
		};
	}
</script>

{#each groups as g (g.category)}
	<BandHeader title={m.rules.categories[g.category] ?? g.category} count={g.rows.length} />
	<table class="table">
		<thead>
			<tr>
				<th scope="col">{m.rules.item}</th>
				<th scope="col" class="num">{m.rules.cost}</th>
				<th scope="col" class="num">{m.rules.limit}</th>
				<th scope="col">{m.rules.restrictions}</th>
			</tr>
		</thead>
		<tbody>
			{#each g.rows as r (r.line.id)}
				{@const x = restrictions(r)}
				<tr>
					<td>
						<a href={elementHref(view.set, r.line.item)}>{r.item?.name ?? r.line.item}</a>
						{#each r.item?.keywords ?? [] as k, i (`${i}:${k.kw}`)}
							<KeywordChip id={k.kw} value={k.value} />
						{/each}
					</td>
					<td class="num">{m.rules.price(r.line.cost, r.line.currency)}</td>
					<td class="num">{r.line.limit ?? m.rules.none}</td>
					<td>
						{#each x.names as n, i (n.id)}{i ? ', ' : ''}<a href={elementHref(view.set, n.id)}
								>{n.name}</a
							>{/each}{#if x.names.length && x.flags.length};
						{/if}{x.flags.join(', ')}{#if !x.names.length && !x.flags.length}{m.rules.none}{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/each}

<style>
	td a {
		color: var(--blood-pale);
		margin-right: var(--space-2);
	}
	table {
		margin-bottom: var(--space-3);
	}
</style>
