<script lang="ts">
	/**
	 * Which rules a warband was built under, and what changed in the rules since: first what touches this warband
	 * (its entries, kit, faction rules, Patron), then the rest of its faction's changes. Its player or the CM takes
	 * note to move it to the current rules.
	 */
	import { enhance } from '$app/forms';
	import type { EntryChange } from '$lib/rules-versions';

	type Info = { pinned: { label: string; at: string }; current: { label: string; at: string }; upToDate: boolean; mine: EntryChange[]; faction: EntryChange[] };
	let { rules, canEdit }: { rules: Info; canEdit: boolean } = $props();

	const KIND: Record<string, string> = { units: 'Unit', items: 'Battlekit', factions: 'Rules', patrons: 'Patron', tables: 'Campaign table' };
	const FIELD: Record<string, string> = {
		cost: 'cost',
		currency: 'paid in',
		availabilityMax: 'most',
		availabilityMin: 'least',
		limit: 'limit',
		keywords: 'keywords',
		stipulations: 'restrictions',
		kit: 'kit rules',
		overrides: 'rules',
		stats: 'profile',
		category: 'category',
		type: 'type',
		range: 'range',
		rows: 'results',
		settings: 'Experience and Promotion rules'
	};
	const date = (s: string) => new Date(s).toLocaleDateString();
	/** "kit heavyOneHand" → "kit rules: heavy one hand". */
	const label = (field: string) => {
		const [head, ...rest] = field.split(' ');
		const words = rest.map((w) => w.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()).join(' ');
		return [FIELD[head] ?? head, words].filter(Boolean).join(': ');
	};
	const what = (c: EntryChange) =>
		c.change === 'added'
			? 'added'
			: c.change === 'removed'
				? 'removed'
				: c.fields.map((f) => (f.from === '' ? `${label(f.field)} ${f.to}` : `${label(f.field)} ${f.from} → ${f.to}`)).join('; ');
</script>

<details class="panel rulespanel version" class:changed={!rules.upToDate} open={!rules.upToDate && rules.mine.length > 0}>
	<summary>
		<h2>Rules{rules.upToDate ? '' : ` · ${rules.mine.length} change${rules.mine.length === 1 ? ' affects' : 's affect'} this warband`}</h2>
	</summary>
	<p>Built under <b>{rules.pinned.label}</b> <small class="dim">({date(rules.pinned.at)})</small>.</p>
	{#if rules.upToDate}
		<p class="dim">These are the current rules.</p>
	{:else}
		<p>The rules are now <b>{rules.current.label}</b> <small class="dim">({date(rules.current.at)})</small>. The builder checks this warband against the current rules.</p>
		{#if rules.mine.length}
			<h3>What changed for this warband</h3>
			<ul>{#each rules.mine as c (c.kind + c.id)}<li><span class="k">{KIND[c.kind]}</span> <b>{c.name}</b>: {what(c)}</li>{/each}</ul>
		{/if}
		{#if rules.faction.length}
			<details>
				<summary>Other changes in your faction ({rules.faction.length})</summary>
				<ul>{#each rules.faction as c (c.kind + c.id)}<li><span class="k">{KIND[c.kind]}</span> <b>{c.name}</b>: {what(c)}</li>{/each}</ul>
			</details>
		{/if}
		{#if canEdit}
			<form method="POST" action="?/rulesAck" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<button class="action small">Noted: move to the current rules</button>
			</form>
		{/if}
	{/if}
</details>

<style>
	.version.changed {
		border-left: 3px solid var(--gold, #c9a24a);
	}
	ul {
		margin: 6px 0;
		padding-left: 1.1rem;
		font-size: 0.9rem;
	}
	li {
		margin: 3px 0;
	}
	.k {
		font-size: 0.75rem;
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	h3 {
		margin: 10px 0 2px;
		font-size: 0.95rem;
	}
</style>
