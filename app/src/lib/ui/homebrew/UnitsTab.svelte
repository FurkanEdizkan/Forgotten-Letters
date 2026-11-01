<!--
  The homebrew editor's Units tab: the set's own units as editable cards (a new one opens), and Add unit, owned by
  the set's faction or variant.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import type { RulesSet } from '#lib/rules/pack';
	import Button from '#lib/ui/Button.svelte';
	import UnitEditor from './UnitEditor.svelte';
	import { freshId, ownerOf, type Base } from './edit';

	type Props = { set: RulesSet; base: Base };
	let { set = $bindable(), base }: Props = $props();
	const u = m.homebrew.units;
	let opened = $state('');

	function add() {
		const owner = ownerOf(set);
		if (!owner) return;
		const id = freshId(set, 'unit', u.newName);
		set.units.push({
			id,
			owner,
			name: u.newName,
			category: 'troop',
			availability: { min: 0, max: null },
			cost: 0,
			currency: 'ducats',
			stats: {},
			keywords: [],
			abilities: [],
			kit: {}
		});
		opened = id;
	}
</script>

<div class="tab">
	{#each set.units as unit, i (unit.id)}
		<UnitEditor
			bind:unit={set.units[i]!}
			bind:set
			{base}
			open={opened === unit.id}
			onremove={() => set.units.splice(i, 1)}
		/>
	{:else}
		<p class="dim">{u.empty}</p>
	{/each}
	<div><Button icon={Plus} onclick={add}>{u.add}</Button></div>
</div>

<style>
	.tab {
		display: grid;
		gap: var(--space-3);
	}
</style>
