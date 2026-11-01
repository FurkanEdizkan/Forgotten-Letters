<!--
  The CM's house rules (the wizard's House rules step and the manage page's Settings tab), in two columns: the rule
  library on the left (presets from #lib/house-rule-presets, plus "Write your own") and the campaign's rules on the
  right, each with an on/off switch, a note, and for settings their value fields. A preset is added by dragging it
  across (native drag and drop) or with its Add button, which works for click and keyboard alike; it can be added
  once. The list posts as one JSON field, `houseRules`; errors arrive keyed by path ("houseRules.2.values.depth").
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import { m } from '#lib/messages';
	import { HOUSE_RULES_MAX, type HouseRule, type Kind } from '#lib/schemas/campaigns';
	import { defaultValues, presetByKey, PRESETS, type Preset } from '#lib/house-rule-presets';
	import Field from './Field.svelte';
	import Select from './Select.svelte';

	type Props = {
		rules: HouseRule[];
		/** The campaign type: presets marked for one type are offered only there. */
		kind: Kind;
		errors?: Record<string, string>;
		disabled?: boolean;
	};
	let { rules = $bindable(), kind, errors = {}, disabled = false }: Props = $props();
	const r = m.campaigns.wizard.rules;

	let filter = $state('');
	let dropping = $state(false);
	/** A campaign rule is being dragged out; the library takes it back (removes it). */
	let removing = $state<number | null>(null);
	let list: HTMLElement | null = $state(null);

	const offered = $derived(
		PRESETS.filter((p) => !p.only || p.only === kind).filter((p) =>
			p.name.toLowerCase().includes(filter.trim().toLowerCase())
		)
	);
	const used = $derived(new Set(rules.map((x) => x.preset).filter(Boolean)));
	const full = $derived(rules.length >= HOUSE_RULES_MAX);

	async function add(p: Preset | null) {
		if (disabled || full || (p && used.has(p.key))) return;
		rules = [
			...rules,
			p
				? {
						name: p.name,
						text: '',
						on: true,
						kind: p.kind,
						preset: p.key,
						values: defaultValues(p)
					}
				: { name: '', text: '', on: true, kind: 'passive', preset: null, values: {} }
		];
		await tick();
		list?.querySelector<HTMLInputElement>('li:last-child input')?.focus();
	}
	const remove = (i: number) => (rules = rules.filter((_, j) => j !== i));

	// Drag data: a preset key or "own" from the library; "rule:<index>" from the campaign's list.
	function ondrop(e: DragEvent) {
		e.preventDefault();
		dropping = false;
		const key = e.dataTransfer?.getData('text/plain');
		if (!key || key.startsWith('rule:')) return;
		if (key === 'own') add(null);
		else add(presetByKey(key) ?? null);
	}
	function ondropRemove(e: DragEvent) {
		e.preventDefault();
		const key = e.dataTransfer?.getData('text/plain');
		if (key?.startsWith('rule:')) remove(Number(key.slice(5)));
		removing = null;
	}
	const err = (i: number, path: string) => errors[`houseRules.${i}.${path}`];
	// Number fields bind as numbers; an emptied one stays a number so the schema can say what is wrong. No min/max
	// on the inputs: the browser would block Save with its own bubble instead of the app's message.
	const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
</script>

<input type="hidden" name="houseRules" value={JSON.stringify(rules)} />

<div class="cols">
	<section
		class="lib"
		class:removing={removing !== null}
		aria-label={r.library}
		ondragover={(e) => {
			if (e.dataTransfer?.types.includes('text/plain') && removing !== null) e.preventDefault();
		}}
		ondrop={ondropRemove}
	>
		{#if removing !== null}<p class="drop out">{r.dropRemove}</p>{/if}
		<h3>{r.library} <span class="dim">{r.libraryHint}</span></h3>
		<Field
			label={r.filter}
			name="rule-filter"
			placeholder={r.filterPlaceholder}
			bind:value={filter}
		/>
		<ul>
			<li>
				<div
					class="card"
					draggable={!disabled && !full}
					role="group"
					aria-label={r.own}
					ondragstart={(e) => e.dataTransfer?.setData('text/plain', 'own')}
				>
					<GripVertical size={14} strokeWidth={1.5} aria-hidden={true} />
					<div>
						<p class="name">{r.own} <span class="kind passive">{r.kindPassive}</span></p>
						<p class="dim">{r.ownSummary}</p>
					</div>
					<button
						type="button"
						class="add"
						onclick={() => add(null)}
						disabled={disabled || full}
						aria-label={r.addRule(r.own)}
						><Plus size={14} strokeWidth={1.6} aria-hidden={true} />{m.common.add}</button
					>
				</div>
			</li>
			{#each offered as p (p.key)}
				{@const taken = used.has(p.key)}
				<li>
					<div
						class="card"
						class:taken
						draggable={!disabled && !full && !taken}
						role="group"
						aria-label={p.name}
						ondragstart={(e) => e.dataTransfer?.setData('text/plain', p.key)}
					>
						<GripVertical size={14} strokeWidth={1.5} aria-hidden={true} />
						<div>
							<p class="name">
								{p.name}
								<span class="kind {p.kind}"
									>{p.kind === 'passive' ? r.kindPassive : r.kindConfig}</span
								>
							</p>
							<p class="dim">
								{p.houseOnly ? `${p.summary} ${r.houseOnly}` : p.summary}
							</p>
						</div>
						{#if taken}
							<span class="dim small">{r.added}</span>
						{:else}
							<button
								type="button"
								class="add"
								onclick={() => add(p)}
								disabled={disabled || full}
								aria-label={r.addRule(p.name)}
								><Plus size={14} strokeWidth={1.6} aria-hidden={true} />{m.common.add}</button
							>
						{/if}
					</div>
				</li>
			{:else}
				<li class="dim">{r.noMatch}</li>
			{/each}
		</ul>
	</section>

	<section
		class="mine"
		class:dropping
		aria-label={r.campaign}
		ondragover={(e) => {
			if (disabled) return;
			e.preventDefault();
			dropping = true;
		}}
		ondragleave={() => (dropping = false)}
		{ondrop}
	>
		<h3>{r.campaign} <span class="dim data">{r.count(rules.length, HOUSE_RULES_MAX)}</span></h3>
		{#if rules.length}
			<ol bind:this={list}>
				{#each rules as rule, i (i)}
					{@const p = rule.preset ? presetByKey(rule.preset) : undefined}
					<li class="rule">
						<div class="top">
							<span
								class="grip"
								draggable={!disabled}
								role="button"
								tabindex="-1"
								aria-label={r.dragOut(rule.name)}
								title={r.dragOut(rule.name)}
								ondragstart={(e) => {
									e.dataTransfer?.setData('text/plain', `rule:${i}`);
									// Changing the page inside dragstart cancels the drag in Chromium; show the hint next tick.
									setTimeout(() => (removing = i));
								}}
								ondragend={() => (removing = null)}
								><GripVertical size={14} strokeWidth={1.5} aria-hidden={true} /></span
							>
							{#if p}
								<p class="name">{rule.name}</p>
							{:else}
								<Field
									label={r.name(i + 1)}
									name="rule-name-{i}"
									placeholder={r.namePlaceholder}
									maxlength={60}
									bind:value={rule.name}
									error={err(i, 'name')}
									{disabled}
								/>
							{/if}
							<span class="kind {rule.kind}"
								>{rule.kind === 'passive' ? r.kindPassive : r.kindConfig}</span
							>
							<label class="switch">
								<input type="checkbox" role="switch" bind:checked={rule.on} {disabled} />
								<span class="box" aria-hidden="true"></span>
								<span class="visually-hidden">{r.on(rule.name)}</span>
							</label>
							<button
								type="button"
								class="x"
								onclick={() => remove(i)}
								{disabled}
								aria-label={r.remove(rule.name)}
								title={r.remove(rule.name)}
								><X size={15} strokeWidth={1.5} aria-hidden={true} /></button
							>
						</div>
						{#if p?.fields.length}
							<div class="values">
								{#each p.fields as f (f.key)}
									{#if f.type === 'boolean'}
										<label class="check">
											<input
												type="checkbox"
												bind:checked={
													() => rule.values[f.key] === true, (v) => (rule.values[f.key] = v)
												}
												{disabled}
											/>
											{f.label}
										</label>
									{:else if f.type === 'choice'}
										<Select
											label={f.label}
											name="rule-{i}-{f.key}"
											options={f.choices}
											bind:value={
												() => String(rule.values[f.key] ?? f.default),
												(v) => (rule.values[f.key] = v ?? f.default)
											}
											{disabled}
										/>
									{:else}
										<div class="numf">
											<Field
												label={f.type === 'inches'
													? `${f.label} (″)`
													: f.unit
														? `${f.label} (${f.unit})`
														: f.label}
												name="rule-{i}-{f.key}"
												type="number"
												inputmode="numeric"
												bind:value={() => rule.values[f.key], (v) => (rule.values[f.key] = num(v))}
												error={err(i, `values.${f.key}`)}
												{disabled}
											/>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
						<Field
							label={r.text(i + 1)}
							name="rule-text-{i}"
							placeholder={p ? r.notePlaceholder : r.textPlaceholder}
							maxlength={500}
							bind:value={rule.text}
							error={err(i, 'text')}
							{disabled}
						/>
						<p class="dim small">{rule.kind === 'passive' ? r.passiveNote : r.configNote}</p>
						{#if err(i, 'preset')}<p class="error">{err(i, 'preset')}</p>{/if}
					</li>
				{/each}
			</ol>
		{:else}
			<p class="dim">{r.empty}</p>
		{/if}
		{#if !disabled && !full}<p class="drop">{r.drop}</p>{/if}
		{#if errors.houseRules}<p class="error">{errors.houseRules}</p>{/if}
	</section>
</div>

<style>
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		gap: var(--space-4);
		align-items: start;
	}
	section {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.lib {
		max-height: 44rem;
		overflow-y: auto;
	}
	h3 {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--size-label);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	h3 .dim {
		text-transform: none;
		letter-spacing: 0;
	}
	ul,
	ol {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-2) var(--space-3);
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule-strong);
		cursor: grab;
	}
	.card.taken {
		opacity: 0.55;
		cursor: default;
	}
	.card :global(svg) {
		color: var(--bone-faint);
	}
	.name {
		margin: 0;
		font-weight: 600;
	}
	.card .dim {
		margin: 0;
		font-size: var(--size-label);
	}
	.kind {
		display: inline-block;
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1.6;
		vertical-align: middle;
	}
	.kind.passive {
		color: var(--bone-dim);
	}
	.kind.configuration {
		color: var(--blood-pale);
		border-color: var(--blood-bright);
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		border: var(--border-hairline) solid var(--rule-strong);
		background: transparent;
		color: var(--bone);
		font: inherit;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		cursor: pointer;
	}
	.add:hover:not(:disabled) {
		background: var(--panel-hover);
	}
	.add:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.add:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
	}
	.add :global(svg) {
		color: inherit;
	}
	.grip {
		display: grid;
		place-items: center;
		color: var(--bone-faint);
		cursor: grab;
	}
	.lib.removing {
		border-color: var(--danger);
	}
	.drop.out {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--panel);
		border-color: var(--danger);
		color: var(--bone);
	}
	.mine.dropping {
		border-color: var(--blood-bright);
	}
	.rule {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.top > :global(:first-child) {
		flex: 1;
	}
	.values {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
	}
	.numf {
		width: 11rem;
	}
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-height: var(--button-height);
	}
	.check input {
		accent-color: var(--blood-bright);
	}
	.x {
		display: grid;
		place-items: center;
		width: 2em;
		height: 2em;
		border: 0;
		background: transparent;
		color: var(--bone-dim);
		cursor: pointer;
	}
	.x:hover {
		color: var(--bone);
	}
	.x:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
	}
	.switch {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.5rem;
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
		background: var(--night);
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
	.drop {
		margin: 0;
		padding: var(--space-3);
		border: var(--border-hairline) dashed var(--rule-strong);
		color: var(--bone-faint);
		text-align: center;
	}
	.dropping .drop {
		border-color: var(--blood-bright);
		color: var(--blood-pale);
	}
	.small {
		margin: 0;
		font-size: var(--size-label);
	}
	.error {
		margin: 0;
		color: var(--bone);
		font-size: var(--size-label);
		border-left: var(--border-status-edge) solid var(--danger);
		padding-left: var(--space-2);
	}
</style>
