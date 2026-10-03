<script lang="ts">
	/**
	 * A list of building limits as sentences: what it counts, at least / at most, for each what, only while what,
	 * read back in plain words as you edit. Drop a rule from the library (or another list) to add a copy. With
	 * `name` it posts the list as JSON in the pack's shape.
	 */
	import { describeLimit, type Limit } from '$lib/warband-limits';
	import { MODES, modeOf, toLimit, type EditLimit, type Mode } from '$lib/limit-edit';
	import { accepts, drag, endDrag, target } from './drag.svelte';
	import ChipList from './ChipList.svelte';
	import ItemSelEditor from './ItemSelEditor.svelte';
	import ModelSelEditor from './ModelSelEditor.svelte';
	import SortableList from './SortableList.svelte';

	let { value = $bindable([]), name, label = 'Rules', scope = 'the models it is about' }: { value?: Limit[]; name?: string; label?: string; scope?: string } = $props();

	const edit = (l: Limit): EditLimit & { key: number } => ({ ...structuredClone($state.snapshot(l) as Limit), mode: modeOf(l), key: Math.random() });
	// svelte-ignore state_referenced_locally
	let rows = $state((value ?? []).map(edit));
	const out = $derived(rows.map(({ key: _k, ...r }) => toLimit(r)));
	$effect(() => {
		value = out;
	});

	let over = $state(false);
	const add = (l: Limit = { items: {}, max: 1 }) => rows.push(edit(l));
	function setMode(r: EditLimit, m: Mode) {
		r.mode = m;
		if (m === 'upgrades' || m === 'entries') r[m] ??= [];
		else r[m] ??= {};
	}
	const num = (s: string) => (s === '' ? undefined : Math.max(0, Number(s)));
	const claim = () => Object.assign(target, { kind: 'limit', label, add: (v: unknown) => v && typeof v === 'object' && add(v as Limit) });
</script>

<div
	class="limits"
	class:over
	role="group"
	aria-label={label}
	onfocusin={claim}
	ondragover={(e) => {
		if (!accepts(['limit'])) return;
		e.preventDefault();
		over = true;
	}}
	ondragleave={() => (over = false)}
	ondrop={(e) => {
		if (!accepts(['limit'])) return;
		e.preventDefault();
		over = false;
		add(drag.value as Limit);
		endDrag();
	}}
>
	<SortableList bind:items={rows} label="{label}: order" removable keyOf={(r) => r.key}>
		{#snippet row(r, i)}
			<div class="limit">
				<p class="say">{describeLimit(out[i] ?? {})}</p>
				<div class="line">
					<label>
						Counts
						<select value={r.mode} onchange={(e) => setMode(r, e.currentTarget.value as Mode)}>
							{#each MODES as [m, l] (m)}<option value={m}>{l}</option>{/each}
						</select>
					</label>
					<label>at least <input type="number" min="0" value={r.min ?? ''} oninput={(e) => (r.min = num(e.currentTarget.value))} /></label>
					<label>at most <input type="number" min="0" value={r.max ?? ''} oninput={(e) => (r.max = num(e.currentTarget.value))} /></label>
				</div>
				{#if r.mode === 'items' || r.mode === 'upgrades'}
					<fieldset>
						<legend>For which models <small>(empty: {scope})</small></legend>
						<ModelSelEditor bind:value={r.who} label="Rule {i + 1}: models" />
					</fieldset>
				{/if}
				<fieldset>
					<legend>
						{r.mode === 'items' || r.mode === 'warband_items' ? 'Which kit' : r.mode === 'upgrades' ? 'Which upgrades' : r.mode === 'entries' ? 'Which entries' : 'Which models'}
					</legend>
					{#if r.mode === 'items'}
						<ItemSelEditor bind:value={r.items} label="Rule {i + 1}: kit" />
						<label class="tick"><input type="checkbox" checked={r.count === 'weapons'} onchange={(e) => (r.count = e.currentTarget.checked ? 'weapons' : undefined)} /> Count weapons (a 2-Handed one is two)</label>
					{:else if r.mode === 'warband_items'}
						<ItemSelEditor bind:value={r.warband_items} label="Rule {i + 1}: kit" />
					{:else if r.mode === 'upgrades'}
						<ChipList kinds={['upgrade']} list="dl-upgrade" label="Rule {i + 1}: upgrades" placeholder="Upgrade names, groups or keywords…" bind:values={() => r.upgrades ?? [], (v) => (r.upgrades = v)} />
					{:else if r.mode === 'entries'}
						<ChipList kinds={['unit']} list="dl-unit" label="Rule {i + 1}: entries" placeholder="Entries…" bind:values={() => r.entries ?? [], (v) => (r.entries = v)} />
					{:else}
						<ModelSelEditor bind:value={r.models} label="Rule {i + 1}: models" />
					{/if}
				</fieldset>
				<details open={!!r.per}>
					<summary>For each…</summary>
					<label class="tick"><input type="checkbox" checked={!!r.per} onchange={(e) => (r.per = e.currentTarget.checked ? { models: {} } : undefined)} /> The most is “at most” for each of these</label>
					{#if r.per}
						<div class="line">
							<label>each <input type="number" min="1" value={r.per.each ?? ''} placeholder="1" oninput={(e) => r.per && (r.per.each = num(e.currentTarget.value))} /></label>
							<label>
								of
								<select value={r.per.items ? 'items' : 'models'} onchange={(e) => r.per && (e.currentTarget.value === 'items' ? ((r.per.items = {}), delete r.per.models) : ((r.per.models = {}), delete r.per.items))}>
									<option value="models">models</option><option value="items">kit</option>
								</select>
							</label>
							<label class="tick"><input type="checkbox" checked={r.per.round === 'up'} onchange={(e) => r.per && (r.per.round = e.currentTarget.checked ? 'up' : undefined)} /> a part counts</label>
							<label class="tick"><input type="checkbox" checked={!!r.per.strict} onchange={(e) => r.per && (r.per.strict = e.currentTarget.checked || undefined)} /> less one</label>
						</div>
						{#if r.per.items}<ItemSelEditor bind:value={r.per.items} label="Rule {i + 1}: for each" />{:else}<ModelSelEditor bind:value={r.per.models} label="Rule {i + 1}: for each" />{/if}
					{/if}
				</details>
				<details open={!!r.when}>
					<summary>Only while…</summary>
					<div class="line">
						<label>other models worth at least <input type="number" min="0" value={r.when?.rating_min ?? ''} oninput={(e) => (r.when = { ...r.when, rating_min: num(e.currentTarget.value) })} /></label>
						<label>or under <input type="number" min="0" value={r.when?.rating_under ?? ''} oninput={(e) => (r.when = { ...r.when, rating_under: num(e.currentTarget.value) })} /> Ducats</label>
					</div>
					<fieldset>
						<legend>The warband has</legend>
						<ModelSelEditor bind:value={() => r.when?.present, (v) => (r.when = { ...r.when, present: v })} label="Rule {i + 1}: while it has" placeholder="Name entries…" />
					</fieldset>
					<fieldset>
						<legend>The warband has no</legend>
						<ModelSelEditor bind:value={() => r.when?.absent, (v) => (r.when = { ...r.when, absent: v })} label="Rule {i + 1}: unless it has" placeholder="Name entries…" />
					</fieldset>
				</details>
				<label class="text">What the builder says when it is broken <small>(empty: the sentence above)</small><input value={r.text ?? ''} oninput={(e) => (r.text = e.currentTarget.value || undefined)} /></label>
			</div>
		{/snippet}
	</SortableList>
	{#if !rows.length}<p class="empty">No rules. Add one, or drag one here from the library.</p>{/if}
	<button type="button" class="ghost" onclick={() => add()}>+ Add a rule</button>
</div>
{#if name}
	<input type="hidden" {name} value={JSON.stringify(out)} />
	<input type="hidden" name="_sent" value={name} />
{/if}

<style>
	.limits {
		display: grid;
		gap: 6px;
	}
	.limits.over {
		outline: 2px dashed var(--blood);
		outline-offset: 4px;
	}
	.limit {
		display: grid;
		gap: 6px;
	}
	.say {
		margin: 0;
		font-weight: 600;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: center;
		font-size: 0.85rem;
	}
	.line label {
		display: inline-flex;
		gap: 5px;
		align-items: center;
	}
	.line input[type='number'] {
		width: 4.5rem;
	}
	fieldset {
		margin: 0;
		padding: 4px 8px 8px;
		border: 1px solid var(--rule);
	}
	legend {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	legend small {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		color: var(--muted);
	}
	.tick {
		display: inline-flex;
		gap: 5px;
		align-items: center;
		font-size: 0.85rem;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	details[open] {
		display: grid;
		gap: 5px;
	}
	.text {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
	}
	.text small,
	.empty {
		color: var(--muted);
	}
	.empty {
		margin: 0;
		font-size: 0.9rem;
	}
</style>
