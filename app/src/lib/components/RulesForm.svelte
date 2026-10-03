<script lang="ts">
	/**
	 * A faction's or variant's building rules in the Rules Editor: what it starts with, must and cannot include,
	 * its upgrades, its own limits and prices, and its rule text. Saving pins these values, whatever the text says.
	 */
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { Limit, PriceRule } from '$lib/warband-limits';
	import type { VariantRules } from '$lib/warband-rules';
	import { clean } from '$lib/limit-edit';
	import ChipList from './ChipList.svelte';
	import LimitEditor from './LimitEditor.svelte';
	import PriceEditor from './PriceEditor.svelte';
	import SortableList from './SortableList.svelte';

	let {
		r,
		own,
		text,
		isVariant,
		patrons,
		errors,
		saved
	}: {
		r: VariantRules;
		own: { limits?: Limit[]; prices?: PriceRule[]; patron?: string | null; requiresVariant?: boolean };
		text: string;
		isVariant: boolean;
		patrons: string[];
		errors: Snippet;
		saved: boolean;
	} = $props();

	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const k = () => Math.random();
	// Seeded once: the page keys this form by faction.
	const [R, O] = (() => [r, own] as const)();
	let must = $state(R.mustInclude.map((m) => ({ ...m, key: k() })));
	let caps = $state(R.caps.map((c) => ({ ...c, key: k() })));
	let upgrades = $state(
		R.upgrades.map((u) => ({ ...structuredClone($state.snapshot(u)), keywords: u.keywords ?? [], limits: u.limits ?? [], ranged: u.hands?.ranged, melee: u.hands?.melee, key: k() }))
	);
	const upgradesOut = $derived(
		upgrades
			.filter((u) => u.name.trim())
			.map((u) => ({
				name: u.name.trim(),
				keyword: u.keyword || undefined,
				max: u.max ?? undefined,
				cost: u.cost ?? 0,
				currency: u.currency,
				text: u.text,
				...clean({ for: u.for, keywords: u.keywords, group: u.group, hands: { ranged: u.ranged, melee: u.melee } }),
				...(u.limits.length ? { limits: $state.snapshot(u.limits) } : {})
			}))
	);
	const num = (s: string) => (s === '' ? null : Math.max(0, Number(s)));
</script>

<form method="POST" action="?/rules&tab=rules" use:enhance={keep} class="rules">
	<p class="lede">
		What the builder uses{isVariant ? ' for this variant (on top of the faction’s own)' : ''}. It starts from what is read from the rule text; saving pins these values,
		whatever the text says.
	</p>
	<fieldset class="grid">
		<legend>Starting out</legend>
		<label>Starting Ducats <input name="start_ducats" type="number" min="0" value={R.startDucats} /></label>
		<label>Starting Glory <input name="start_glory" type="number" min="0" value={R.startGlory} /></label>
		<label>Fireteams <input name="fireteams" type="number" min="0" value={R.fireteams} /></label>
		<label>Leader <input name="leader" value={R.leader ?? ''} list="dl-unit" /></label>
		<label>Must serve the Patron <input name="patron" value={O.patron ?? R.patron ?? ''} list="dl-patron" /></label>
		<label class="tick"><input type="checkbox" name="requires_variant" checked={O.requiresVariant ?? R.requiresVariant} /> Must be one of its variants</label>
		<input type="hidden" name="_sent" value="patron" />
	</fieldset>

	<fieldset>
		<legend>Who it may include</legend>
		<span class="lbl">Cannot include <small>(entries, or “Mercenaries”)</small></span>
		<ChipList name="excluded" kinds={['unit']} list="dl-unit" label="Cannot include" placeholder="Entries…" values={R.excluded} />
		<span class="lbl">No longer required <small>(entries whose usual “must include” is lifted)</small></span>
		<ChipList name="optional" kinds={['unit']} list="dl-unit" label="No longer required" placeholder="Entries…" values={R.optional} />
		<div class="pairs">
			<div>
				<span class="lbl">Must include</span>
				<SortableList bind:items={must} label="Must include" removable keyOf={(m) => m.key}>
					{#snippet row(m)}<div class="pair"><input name="mi_name" bind:value={m.name} list="dl-unit" aria-label="Entry" /><input name="mi_n" type="number" min="1" bind:value={m.n} aria-label="How many" /></div>{/snippet}
				</SortableList>
				<button type="button" class="ghost mini" onclick={() => must.push({ name: '', n: 1, key: k() })}>+ Entry</button>
			</div>
			<div>
				<span class="lbl">At most</span>
				<SortableList bind:items={caps} label="At most" removable keyOf={(c) => c.key}>
					{#snippet row(c)}<div class="pair"><input name="cap_name" bind:value={c.name} list="dl-unit" aria-label="Entry" /><input name="cap_max" type="number" min="0" bind:value={c.max} aria-label="At most" /></div>{/snippet}
				</SortableList>
				<button type="button" class="ghost mini" onclick={() => caps.push({ name: '', max: 1, key: k() })}>+ Entry</button>
			</div>
		</div>
		<span class="lbl">Free items <small>(given free the first time)</small></span>
		<ChipList name="free_items" kinds={['item']} list="dl-item" label="Free items" placeholder="Armoury items…" values={R.freeItems} />
	</fieldset>

	<fieldset>
		<legend>Upgrades <small>(a keyword or rule a number of models may take)</small></legend>
		<SortableList bind:items={upgrades} label="Upgrades" removable keyOf={(u) => u.key}>
			{#snippet row(u, i)}
				<div class="upgrade">
					<div class="grid">
						<label class="wide">Name <input bind:value={u.name} /></label>
						<label>Keyword <input bind:value={() => u.keyword ?? '', (v) => (u.keyword = v.toUpperCase() || null)} list="dl-keyword" /></label>
						<label>Models <input type="number" min="0" value={u.max ?? ''} placeholder="any" oninput={(e) => (u.max = num(e.currentTarget.value))} /></label>
						<label>Cost <input type="number" min="0" bind:value={u.cost} /></label>
						<label>In <select bind:value={u.currency}><option value="ducats">Ducats</option><option value="glory">Glory</option></select></label>
						<label class="wide">Text <textarea rows="2" bind:value={u.text}></textarea></label>
					</div>
					<details open={!!(u.for.length || u.keywords.length || u.group || u.limits.length || u.ranged != null || u.melee != null)}>
						<summary>Who may take it, more keywords, its rules…</summary>
						<span class="lbl">Only for <small>(empty: any model)</small></span>
						<ChipList kinds={['unit']} list="dl-unit" label="Upgrade {i + 1}: for" placeholder="Entries…" bind:values={u.for} />
						<span class="lbl">More keywords it grants</span>
						<ChipList kinds={['keyword']} list="dl-keyword" upper label="Upgrade {i + 1}: keywords" placeholder="Keywords…" bind:values={u.keywords} />
						<div class="grid">
							<label>Group <input bind:value={() => u.group ?? '', (v) => (u.group = v || undefined)} placeholder="Goetic Power" /></label>
							<label>Ranged held <input type="number" min="0" value={u.ranged ?? ''} oninput={(e) => (u.ranged = num(e.currentTarget.value) ?? undefined)} /></label>
							<label>Melee held <input type="number" min="0" value={u.melee ?? ''} oninput={(e) => (u.melee = num(e.currentTarget.value) ?? undefined)} /></label>
						</div>
						<span class="lbl">Rules for models with it</span>
						<LimitEditor bind:value={u.limits} label="Upgrade {i + 1} rules" scope="the models with it" />
					</details>
				</div>
			{/snippet}
		</SortableList>
		<button type="button" class="ghost" onclick={() => upgrades.push({ name: '', keyword: null, max: null, cost: 0, currency: 'ducats', for: [], text: '', keywords: [], limits: [], ranged: undefined, melee: undefined, key: k() })}>+ Add an upgrade</button>
		<input type="hidden" name="upgrades_json" value={JSON.stringify(upgradesOut)} />
	</fieldset>

	<fieldset>
		<legend>Its building rules <small>(for every model, or those named)</small></legend>
		<LimitEditor name="rules_limits" label="Warband rules" scope="every model" value={O.limits ?? []} />
	</fieldset>

	<fieldset>
		<legend>Prices set by rule</legend>
		<PriceEditor name="rules_prices" value={O.prices ?? []} />
	</fieldset>

	<label class="text">Rule text <small>(shown in the builder’s special rules; “* Name: text”, a blank line between)</small><textarea name="text" rows="10">{text}</textarea></label>
	{@render errors()}
	<div class="actions"><button>Save rules</button>{#if saved}<span class="ok" role="status">Saved.</span>{/if}</div>
</form>

<style>
	.rules {
		display: grid;
		gap: 12px;
	}
	.lede {
		margin: 0;
		max-width: 64ch;
		color: var(--ink-soft);
	}
	fieldset {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 6px 12px 12px;
		border: 1px solid var(--rule);
	}
	legend {
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	small {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 6px 12px;
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	label {
		display: grid;
		gap: 2px;
		font-size: 0.85rem;
	}
	label > input:not([type='checkbox']),
	label > select,
	label > textarea,
	.pair > input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.tick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.lbl {
		font-size: 0.85rem;
	}
	.pairs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 12px;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 4.5rem;
		gap: 4px;
	}
	.upgrade,
	details[open] {
		display: grid;
		gap: 6px;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	.mini {
		padding: 2px 10px;
	}
	button.ghost {
		justify-self: start;
	}
	.text small {
		color: var(--muted);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
		position: sticky;
		bottom: 0;
		padding: 8px 0;
		background: var(--paper);
		border-top: 1px solid var(--rule);
	}
	.ok {
		color: var(--supplies);
	}
</style>
