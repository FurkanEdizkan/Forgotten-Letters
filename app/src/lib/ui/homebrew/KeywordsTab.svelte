<!--
  The homebrew editor's Keywords tab: the set's own keywords, each a name, a kind (tag, effect or both), whether it
  takes a value, and its explanation in the player's own words; and adding one.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import type { RulesSet } from '#lib/rules/pack';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import { addKeyword } from './edit';

	type Props = { set: RulesSet };
	let { set = $bindable() }: Props = $props();
	const k = m.homebrew.keywords;
	const kinds = (['tag', 'effect', 'both'] as const).map((x) => ({ value: x, label: k.kinds[x]! }));
	const params = Object.entries(k.params).map(([value, label]) => ({ value, label }));
</script>

<div class="tab">
	<h3>{k.title}</h3>
	{#each set.keywords as kw, i (kw.id)}
		<div class="kw" data-keyword={kw.id}>
			<div class="row3">
				<Field label={k.name} name="kwName" maxlength={120} bind:value={kw.name} />
				<Select label={k.kind} name="kwKind" options={kinds} bind:value={kw.kind} />
				<Select
					label={k.param}
					name="kwParam"
					options={params}
					bind:value={
						() => kw.param ?? '',
						(v) => {
							if (v) kw.param = v as NonNullable<typeof kw.param>;
							else delete kw.param;
						}
					}
				/>
			</div>
			<TextArea label={k.text} name="kwText" rows={2} maxlength={20000} bind:value={kw.text} />
			<div class="foot">
				<Button kind="danger" icon={X} onclick={() => set.keywords.splice(i, 1)}>{k.remove}</Button>
			</div>
		</div>
	{:else}
		<p class="dim">{k.empty}</p>
	{/each}
	<div><Button icon={Plus} onclick={() => addKeyword(set, k.newName)}>{k.add}</Button></div>
</div>

<style>
	.tab {
		display: grid;
		gap: var(--space-3);
		max-width: 60rem;
	}
	.kw {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.row3 {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
		align-items: start;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
	}
</style>
