<!--
  The CM's house rules as an editable list (the wizard's House rules step and the manage page's Settings tab): each
  rule is a name, the CM's explanation and an on/off switch, up to 30. The list posts as one JSON field,
  `houseRules`, which the form action turns back into the list. Errors arrive keyed by row
  ("houseRules.2.name"), as the shared schema reports them. The CM's own words only; no book text ships.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import { HOUSE_RULES_MAX, type HouseRule } from '#lib/schemas/campaigns';
	import Button from './Button.svelte';
	import Field from './Field.svelte';

	type Props = {
		rules: HouseRule[];
		errors?: Record<string, string>;
		disabled?: boolean;
	};
	let { rules = $bindable(), errors = {}, disabled = false }: Props = $props();
	const r = m.campaigns.wizard.rules;

	let list: HTMLElement | null = $state(null);

	async function add() {
		rules = [...rules, { name: '', text: '', on: true }];
		// Put the cursor in the new rule's name.
		await tick();
		list?.querySelector<HTMLInputElement>('li:last-child input')?.focus();
	}
	const remove = (i: number) => (rules = rules.filter((_, j) => j !== i));
</script>

<input type="hidden" name="houseRules" value={JSON.stringify(rules)} />
{#if rules.length}
	<div class="cols label" aria-hidden="true">
		<span>{r.colName}</span><span>{r.colText}</span><span>{r.colOn}</span><span></span>
	</div>
	<ol class="rules" bind:this={list}>
		{#each rules as rule, i (i)}
			<li>
				<Field
					label={r.name(i + 1)}
					name="rule-name-{i}"
					placeholder={r.namePlaceholder}
					maxlength={60}
					bind:value={rule.name}
					error={errors[`houseRules.${i}.name`]}
					{disabled}
				/>
				<Field
					label={r.text(i + 1)}
					name="rule-text-{i}"
					placeholder={r.textPlaceholder}
					maxlength={500}
					bind:value={rule.text}
					error={errors[`houseRules.${i}.text`]}
					{disabled}
				/>
				<label class="switch">
					<input type="checkbox" role="switch" bind:checked={rule.on} {disabled} />
					<span class="box" aria-hidden="true"></span>
					<span class="visually-hidden">{r.on(rule.name)}</span>
				</label>
				<Button icon={X} onclick={() => remove(i)} {disabled}>{r.remove}</Button>
			</li>
		{/each}
	</ol>
{:else}
	<p class="dim">{r.empty}</p>
{/if}
{#if errors.houseRules}<p class="dim">{errors.houseRules}</p>{/if}
<div class="foot">
	<Button icon={Plus} onclick={add} disabled={disabled || rules.length >= HOUSE_RULES_MAX}
		>{r.add}</Button
	>
	<span class="dim small data">{r.count(rules.length, HOUSE_RULES_MAX)}</span>
</div>

<style>
	.cols {
		gap: var(--space-3);
		margin-bottom: calc(-1 * var(--space-2));
	}
	.rules {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--border-opening) solid var(--rule-strong);
	}
	.cols,
	li {
		display: grid;
		grid-template-columns: minmax(10rem, 1fr) minmax(0, 2fr) 2.5rem 7.5rem;
		gap: var(--space-3);
		align-items: end;
		padding-top: var(--space-3);
	}
	/* The labels name the row for screen readers; the columns already say what they are. */
	li :global(.label) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.switch {
		position: relative;
		display: grid;
		place-items: center;
		height: var(--button-height);
		cursor: pointer;
	}
	.switch input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.box {
		position: relative;
		width: 20px;
		height: 20px;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
	}
	.switch input:checked + .box {
		background: var(--blood);
		border-color: var(--blood);
	}
	.switch input:checked + .box::after {
		content: '';
		position: absolute;
		left: 6px;
		top: 2px;
		width: 5px;
		height: 10px;
		border: solid var(--bone);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	.switch input:focus-visible + .box {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.small {
		font-size: var(--size-label);
	}
</style>
