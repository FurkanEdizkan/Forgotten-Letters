<!--
  The homebrew editor's Armoury tab: armoury lines (an official or own item at the player's price, currency and
  limit, and which units only may buy it), adding a line, the set's own items (range, hands or type, category,
  keywords, rules in the player's own words), and making a new item, which gets a line of its own at once.
  A set of items picks, for each line, the faction it sells to.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import { lineAllows, toggleLine } from '#lib/rules/homebrew';
	import { CURRENCIES, ITEM_CATEGORIES, ITEM_TYPES, type RulesSet } from '#lib/rules/pack';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import IdChips from './IdChips.svelte';
	import { freshId, int, itemOptions, keywordOptions, ownerOf, type Base } from './edit';

	type Props = { set: RulesSet; base: Base };
	let { set = $bindable(), base }: Props = $props();
	const a = m.homebrew.armoury;
	const currencies = CURRENCIES.map((c) => ({ value: c, label: m.homebrew.units.currencies[c]! }));
	const categories = ITEM_CATEGORIES.map((c) => ({
		value: c,
		label: c[0]!.toUpperCase() + c.slice(1)
	}));
	const types = ITEM_TYPES.map((t) => ({ value: t, label: t }));
	const owners = $derived(base.factions.map((f) => ({ value: f.id, label: f.name })));

	const own = $derived(ownerOf(set));
	let pick = $state('');
	let pickOwner = $state('');
	let item = $state({ name: '', category: 'melee', type: '1-Handed', range: '' });

	const itemName = (id: string) =>
		[...base.items, ...set.items].find((i) => i.id === id)?.name ?? id;
	/** The units a line's "only" may name: the set's own of that owner, and the base's. */
	const unitsOf = (owner: string) =>
		[
			...set.units.filter((u) => u.owner === owner),
			...base.units.filter((u) => u.owner === owner)
		].map((u) => ({ id: u.id, name: u.name }));

	function addLine(itemId: string, owner: string) {
		set.armouryLines.push({
			id: freshId(set, 'line', `${owner.split('/').at(-1)}-${itemName(itemId)}`),
			owner,
			item: itemId,
			cost: 0,
			currency: 'ducats'
		});
	}
	function toggle(i: number, unitId: string) {
		const l = set.armouryLines[i]!;
		set.armouryLines[i] = toggleLine(
			l,
			unitId,
			unitsOf(l.owner).map((u) => u.id)
		);
	}
	function createItem() {
		const id = freshId(set, 'item', item.name);
		set.items.push({
			id,
			name: item.name.trim(),
			category: item.category as RulesSet['items'][number]['category'],
			type: item.type as RulesSet['items'][number]['type'],
			...(item.range.trim() ? { range: item.range.trim() } : {}),
			keywords: []
		});
		const owner = own ?? pickOwner;
		if (owner) addLine(id, owner);
		item = { name: '', category: 'melee', type: '1-Handed', range: '' };
	}
	$effect.pre(() => {
		if (!own && !pickOwner && owners[0]) pickOwner = owners[0].value;
	});
</script>

<div class="tab">
	<section>
		<h3>{a.lines}</h3>
		<p class="dim small">{a.linesHint}</p>
		{#each set.armouryLines as line, i (line.id)}
			<div class="line" data-line={line.id}>
				<strong class="iname">{itemName(line.item)}</strong>
				{#if !own}
					<Select label={a.owner} name="lineOwner" options={owners} bind:value={line.owner} />
				{/if}
				<Field
					label={a.cost}
					name="lineCost"
					type="number"
					min={0}
					bind:value={() => line.cost, (v) => (line.cost = int(v) as number)}
				/>
				<Select
					label={m.homebrew.units.currency}
					name="lineCurrency"
					options={currencies}
					bind:value={line.currency}
				/>
				<Field
					label={a.limit}
					name="lineLimit"
					type="number"
					min={0}
					placeholder={a.limitHint}
					bind:value={
						() => line.limit ?? '',
						(v) => {
							const n = int(v);
							if (n === undefined) delete line.limit;
							else line.limit = n;
						}
					}
				/>
				<button
					type="button"
					class="icon"
					aria-label="{a.remove} {itemName(line.item)}"
					onclick={() => set.armouryLines.splice(i, 1)}><X size={16} aria-hidden={true} /></button
				>
				{#if unitsOf(line.owner).length}
					<div class="only">
						<span class="dim small">{a.only}:</span>
						{#each unitsOf(line.owner) as u (u.id)}
							<label class="check">
								<input
									type="checkbox"
									checked={lineAllows(line, u.id)}
									onchange={() => toggle(i, u.id)}
								/>
								{u.name}
							</label>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<p class="dim">{a.empty}</p>
		{/each}
		<div class="add">
			{#if !own}
				<Select label={a.owner} name="newOwner" options={owners} bind:value={pickOwner} />
			{/if}
			<Select
				label={a.item}
				name="newLineItem"
				options={[{ value: '', label: a.pick }, ...itemOptions(set, base)]}
				bind:value={pick}
			/>
			<Button
				icon={Plus}
				disabled={!pick || !(own ?? pickOwner)}
				onclick={() => {
					addLine(pick, own ?? pickOwner);
					pick = '';
				}}>{a.addLine}</Button
			>
		</div>
	</section>

	<section>
		<h3>{a.items}</h3>
		{#each set.items as it, i (it.id)}
			<div class="item" data-item={it.id}>
				<div class="row4">
					<Field label={a.itemName} name="itemName" maxlength={120} bind:value={it.name} />
					<Select
						label={a.category}
						name="itemCategory"
						options={categories}
						bind:value={it.category}
					/>
					<Select label={a.type} name="itemType" options={types} bind:value={it.type} />
					<Field
						label={a.range}
						name="itemRange"
						maxlength={40}
						bind:value={
							() => it.range ?? '',
							(v) => {
								if (v) it.range = v;
								else delete it.range;
							}
						}
					/>
				</div>
				<IdChips
					label={m.homebrew.units.keywords}
					placeholder={m.homebrew.keywords.pick}
					ids={it.keywords.map((k) => k.kw)}
					options={keywordOptions(set, base)}
					onadd={(id) => it.keywords.push({ kw: id })}
					onremove={(k) => it.keywords.splice(k, 1)}
				/>
				<TextArea
					label={a.text}
					name="itemText"
					rows={2}
					bind:value={() => it.text ?? '', (v) => (it.text = v || undefined)}
				/>
				<div class="foot">
					<Button kind="danger" icon={X} onclick={() => set.items.splice(i, 1)}>{a.remove}</Button>
				</div>
			</div>
		{:else}
			<p class="dim">{a.itemsEmpty}</p>
		{/each}
		<fieldset class="new">
			<legend>{a.newItem}</legend>
			<div class="row4">
				<Field label={a.itemName} name="newItemName" maxlength={120} bind:value={item.name} />
				<Select
					label={a.category}
					name="newItemCategory"
					options={categories}
					bind:value={item.category}
				/>
				<Select label={a.type} name="newItemType" options={types} bind:value={item.type} />
				<Field
					label={a.range}
					name="newItemRange"
					maxlength={40}
					placeholder={a.rangeHint}
					bind:value={item.range}
				/>
			</div>
			<div>
				<Button icon={Plus} disabled={!item.name.trim()} onclick={createItem}>{a.create}</Button>
			</div>
		</fieldset>
	</section>
</div>

<style>
	.tab,
	section {
		display: grid;
		gap: var(--space-3);
	}
	.tab {
		gap: var(--space-6);
	}
	.line {
		display: grid;
		grid-template-columns: minmax(10rem, 2fr) repeat(3, minmax(0, 1fr)) auto;
		gap: var(--space-3);
		align-items: end;
		padding: var(--space-2) var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.line:has(:global(select[name='lineOwner'])) {
		grid-template-columns: minmax(10rem, 2fr) minmax(0, 2fr) repeat(3, minmax(0, 1fr)) auto;
	}
	.iname {
		align-self: center;
		font-family: var(--font-display);
		font-weight: normal;
	}
	.only {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		align-items: center;
	}
	.check {
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
	}
	.item,
	.new {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.row4 {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
		align-items: start;
	}
	legend {
		padding: 0 var(--space-1);
		font-family: var(--font-display);
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--button-height);
		height: var(--button-height);
		background: none;
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone-dim);
		cursor: pointer;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
	}
	.small {
		font-size: var(--size-label);
	}
</style>
