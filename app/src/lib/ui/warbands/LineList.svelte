<!--
  An armoury as the builder offers it: lines by category, each with its item's name (linked to the compendium), its
  keyword chips (pop-ups), its price and "used / most" for a Battlekit Limit, and Buy, or the reasons it cannot be
  taken now. A refused buy shows the
  engine's reasons beside its line.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { peek } from '#lib/ui/rules/peek.svelte';
	import { elementHref } from '#lib/rules/text';
	import type { Item } from '#lib/rules/pack';
	import type { ApiArmouryLine } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import KeywordChip from '#lib/ui/rules/KeywordChip.svelte';
	import { rulesView } from '#lib/ui/rules/context';

	type Props = {
		lines: ApiArmouryLine[];
		items: Record<string, Item>;
		op: 'buy' | 'stashBuy';
		fid?: string;
		/** The campaign allows going beyond limits: a refused line may still be bought (with a warning). */
		beyond: boolean;
		form: FormResult;
	};
	let { lines, items, op, fid, beyond, form }: Props = $props();
	const b = m.warbands.builder;
	const view = rulesView();
	const groups = $derived.by(() => {
		const by: Record<string, ApiArmouryLine[]> = {};
		for (const l of lines) (by[l.category] ??= []).push(l);
		return Object.entries(by).sort(([a], [z]) => a.localeCompare(z));
	});
</script>

{#each groups as [category, list] (category)}
	<section>
		<h3>{b.categories[category] ?? category}</h3>
		<ul>
			{#each list as l (l.lineId)}
				{@const r = resultOf(form, op, l.lineId)}
				<li class:off={!l.ok} data-line={l.lineId}>
					<div class="what">
						<a href={elementHref(view.set, l.itemId)} use:peek={l.itemId}>{l.name}</a>
						{#each items[l.itemId]?.keywords ?? [] as k, i (`${i}:${k.kw}`)}<KeywordChip
								id={k.kw}
								value={k.value}
							/>{/each}
						{#if !l.ok}<p class="why">{l.reasons.join('. ')}.</p>{/if}
						{#if r.error}<p class="why" role="alert">{r.error}</p>{/if}
					</div>
					<span class="data price"
						>{m.warbands.price(l.price, l.currency)}{#if l.limit != null}<span class="used"
								>{b.usedOf(l.used ?? 0, l.limit)}</span
							>{/if}</span
					>
					<form method="POST" action="?/{op}" use:enhance>
						<input type="hidden" name="op" value={op} />
						<input type="hidden" name="id" value={l.lineId} />
						<input type="hidden" name="lineId" value={l.lineId} />
						{#if fid}<input type="hidden" name="fid" value={fid} />{/if}
						<Button type="submit" disabled={!l.ok && !beyond}>{b.buy}</Button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	section {
		display: grid;
		gap: var(--space-2);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 7rem auto;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.what {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		align-items: center;
	}
	.what a {
		color: var(--bone);
	}
	.off .what a {
		color: var(--bone-dim);
	}
	.why {
		flex-basis: 100%;
		margin: 0;
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.price {
		display: grid;
		text-align: right;
	}
	.used {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>
