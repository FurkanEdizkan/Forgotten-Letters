<!--
  The equip picker for one fighter (opened from a Battlekit category's +): the armoury lines it may look at, by
  category (the chosen one first, or all), with price, "used / most" for a Battlekit Limit (counted across the
  warband and the Arsenal, as the book counts it), keyword pop-ups and the reasons a line cannot be taken now. What it
  carries and its upgrades are on the fighter's panel.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { Item } from '#lib/rules/pack';
	import type { ApiArmouryLine, ApiFighter } from '#lib/schemas/warbands';
	import type { FormResult } from '#lib/ui/form-result';
	import Dialog from './Dialog.svelte';
	import LineList from './LineList.svelte';

	type Props = {
		fighter: ApiFighter;
		armoury: ApiArmouryLine[];
		/** The Battlekit category it was opened for, or null for all. */
		category: string | null;
		items: Record<string, Item>;
		beyond: boolean;
		form: FormResult;
		onclose: () => void;
	};
	let { fighter: x, armoury, category, items, beyond, form, onclose }: Props = $props();
	const b = m.warbands.builder;
	let shown = $state<string | null>(null);
	const cat = $derived(shown === null ? category : shown || null);
	const cats = $derived([...new Set(armoury.map((l) => l.category))]);
	const lines = $derived(cat ? armoury.filter((l) => l.category === cat) : armoury);
</script>

<Dialog title={b.equipTitle(x.name ?? x.unitName)} {onclose} wide>
	<div class="tabs" role="group" aria-label={b.categoriesLabel}>
		<button type="button" class:on={!cat} onclick={() => (shown = '')}>{b.all}</button>
		{#each cats as c (c)}
			<button type="button" class:on={cat === c} onclick={() => (shown = c)}
				>{b.categories[c] ?? c}</button
			>
		{/each}
	</div>
	<section class="armoury">
		<LineList {lines} {items} op="buy" fid={x.id} {beyond} {form} />
	</section>
</Dialog>

<style>
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.tabs button {
		padding: var(--space-1) var(--space-3);
		background: var(--panel-raised);
		color: var(--bone-dim);
		border: var(--border-hairline) solid var(--rule-strong);
		font: inherit;
		cursor: pointer;
	}
	.tabs button.on {
		background: var(--blood);
		border-color: var(--blood);
		color: var(--bone);
	}
	.armoury {
		display: grid;
		gap: var(--space-3);
		max-height: 60vh;
		overflow-y: auto;
		padding-right: var(--space-2);
	}
</style>
