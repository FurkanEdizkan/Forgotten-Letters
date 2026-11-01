<!--
  A list of chosen entries (keywords, kit) as chips, each removable, and a select with Add for one more, styled as
  the shared Select. An optional snippet after it makes a new entry (a new keyword by name).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';

	type Props = {
		label: string;
		/** The select's first, empty choice: "Add a keyword", "Add an item". */
		placeholder: string;
		ids: string[];
		options: { value: string; label: string }[];
		onadd: (id: string) => void;
		onremove: (index: number) => void;
		extra?: Snippet;
	};
	let { label, placeholder, ids, options, onadd, onremove, extra }: Props = $props();
	const uid = $props.id();
	let pick = $state('');
	const nameOf = (id: string) => options.find((o) => o.value === id)?.label ?? id;
	const free = $derived(options.filter((o) => !ids.includes(o.value)));
</script>

<div class="chips" role="group" aria-labelledby="{uid}-l">
	<span class="label" id="{uid}-l">{label}</span>
	{#if ids.length}
		<ul>
			{#each ids as id, i (`${id}-${i}`)}
				<li class="chip">
					{nameOf(id)}
					<button
						type="button"
						aria-label="{m.homebrew.armoury.remove} {nameOf(id)}"
						onclick={() => onremove(i)}><X size={14} aria-hidden={true} /></button
					>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="add">
		<div class="well">
			<select aria-label="{label}: {placeholder}" bind:value={pick}>
				<option value="">{placeholder}</option>
				{#each free as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<ChevronDown size={16} strokeWidth={1.5} aria-hidden={true} />
		</div>
		<Button
			icon={Plus}
			disabled={!pick}
			onclick={() => {
				onadd(pick);
				pick = '';
			}}>{m.common.add}</Button
		>
		{#if extra}{@render extra()}{/if}
	</div>
</div>

<style>
	.chips {
		display: grid;
		gap: var(--space-1);
	}
	.label {
		font-size: var(--size-label);
		color: var(--bone-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		font-size: var(--size-label);
	}
	.chip button {
		display: inline-flex;
		padding: 0;
		background: none;
		border: 0;
		color: var(--bone-dim);
		cursor: pointer;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.well {
		position: relative;
		display: flex;
		align-items: center;
		min-width: 14rem;
	}
	select,
	.add :global(input) {
		width: 100%;
		min-height: var(--button-height);
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
	}
	select {
		padding-right: calc(var(--space-2) + 24px);
		appearance: none;
		cursor: pointer;
	}
	.add :global(input) {
		width: 14rem;
	}
	select:focus,
	.add :global(input:focus) {
		border-color: var(--blood-bright);
	}
	.well :global(svg) {
		position: absolute;
		right: var(--space-2);
		color: var(--bone-dim);
		pointer-events: none;
	}
</style>
