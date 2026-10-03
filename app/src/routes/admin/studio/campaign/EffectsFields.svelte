<script lang="ts">
	/**
	 * What a Campaign Phase table result does to the model, as the builder acts on it: each known effect with its own
	 * control. Posts the pack's shape as JSON in `name` (one per row, in order).
	 */
	import type { Effects } from '$lib/progression';
	import type { ItemSel, Limit } from '$lib/warband-limits';
	import { clean } from '$lib/limit-edit';
	import ChipList from '$lib/components/ChipList.svelte';
	import ItemSelEditor from '$lib/components/ItemSelEditor.svelte';
	import LimitEditor from '$lib/components/LimitEditor.svelte';

	let { value, name, label }: { value: Effects | undefined; name: string; label: string } = $props();

	const FLAGS = [
		['dead', 'Dead'],
		['retire', 'Retires'],
		['miss_next_battle', 'Misses the next battle'],
		['no_experience', 'No Experience this time'],
		['scar', 'A Battle Scar'],
		['pick_skill', 'Picks a Skill'],
		['patron_skill', 'Gains a Patron Skill'],
		['not_counted_elite', 'Not counted among the ELITE at Promotion']
	] as const;
	const NUMBERS = [
		['extra_scars', 'More Battle Scars before Unfit'],
		['promotion_dice', 'Dice added to the Promotion Pool'],
		['xp_to_others', 'Experience to each other ELITE']
	] as const;
	const STATS = ['movement', 'ranged', 'melee', 'armour'] as const;

	// Seeded once: the row is keyed by its parent.
	const E = $state.snapshot((() => value ?? {})()) as Effects;
	let e = $state<Effects>({ ...E, limits: undefined, lose_kit: undefined });
	let limits = $state<Limit[]>(E.limits ?? []);
	let lose = $state<'' | 'all' | 'match'>(E.lose_kit === true ? 'all' : E.lose_kit ? 'match' : '');
	let loseSel = $state<ItemSel | undefined>(E.lose_kit && E.lose_kit !== true ? E.lose_kit : undefined);

	const out = $derived.by(() => {
		const xp = e.extra_xp;
		const o = (clean({ ...$state.snapshot(e), extra_xp: typeof xp === 'string' && /^\d+$/.test(xp.trim()) ? Number(xp) : xp }) ?? {}) as Effects;
		// Limits as written: an empty `{}` inside one means "any".
		if (limits.length) o.limits = $state.snapshot(limits) as Limit[];
		if (lose === 'all') o.lose_kit = true;
		else if (lose === 'match') o.lose_kit = (clean($state.snapshot(loseSel)) as ItemSel | undefined) ?? {};
		return o;
	});
	const NAMES: Record<string, string> = Object.fromEntries([...FLAGS, ...NUMBERS, ['stats', 'profile'], ['keywords', 'keywords'], ['remove_keywords', 'loses keywords'], ['limits', 'rules'], ['lose_kit', 'loses kit'], ['extra_xp', 'more Experience']]);
	const summary = $derived(Object.keys(out).map((k) => NAMES[k] ?? k).join(', '));
	const num = (s: string) => (s === '' ? undefined : Number(s));
</script>

<details class="effects" open={false}>
	<summary>Effects{summary ? `: ${summary}` : ' (text only)'}</summary>
	<div class="flags" role="group" aria-label="{label}: what happens">
		{#each FLAGS as [k, l] (k)}
			<label class="tick"><input type="checkbox" checked={!!e[k]} onchange={(ev) => (e[k] = ev.currentTarget.checked || undefined)} /> {l}</label>
		{/each}
	</div>
	<div class="row" role="group" aria-label="{label}: profile changes">
		{#each STATS as s (s)}
			<label>{s} <input type="number" value={e.stats?.[s] ?? ''} oninput={(ev) => (e.stats = { ...e.stats, [s]: num(ev.currentTarget.value) })} /></label>
		{/each}
	</div>
	<div class="row">
		{#each NUMBERS as [k, l] (k)}
			<label>{l} <input type="number" min="0" value={e[k] ?? ''} oninput={(ev) => (e[k] = num(ev.currentTarget.value))} /></label>
		{/each}
		<label>More Experience <input value={e.extra_xp ?? ''} placeholder="2 or D3" oninput={(ev) => (e.extra_xp = ev.currentTarget.value || undefined)} /></label>
	</div>
	<span class="lbl">Gains keywords</span>
	<ChipList kinds={['keyword']} list="dl-keyword" upper label="{label}: gains keywords" placeholder="Keywords…" bind:values={() => e.keywords ?? [], (v) => (e.keywords = v)} />
	<span class="lbl">Loses keywords</span>
	<ChipList kinds={['keyword']} list="dl-keyword" upper label="{label}: loses keywords" placeholder="Keywords…" bind:values={() => e.remove_keywords ?? [], (v) => (e.remove_keywords = v)} />
	<label>
		Loses kit when recorded
		<select bind:value={lose}><option value="">no</option><option value="all">all it can lose</option><option value="match">what matches…</option></select>
	</label>
	{#if lose === 'match'}<ItemSelEditor bind:value={loseSel} label="{label}: kit it loses" />{/if}
	<span class="lbl">Rules on the model while it has this</span>
	<LimitEditor bind:value={limits} label="{label} rules" scope="this model" />
</details>
<input type="hidden" {name} value={JSON.stringify(out)} />

<style>
	.effects[open] {
		display: grid;
		gap: 6px;
		padding: 6px 0 4px 10px;
		border-left: 2px solid var(--rule);
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	.flags,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 0.85rem;
	}
	.tick,
	.row label {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.row input {
		width: 4.5rem;
	}
	.lbl,
	label {
		font-size: 0.85rem;
	}
	.effects > label {
		display: grid;
		gap: 2px;
		justify-items: start;
	}
</style>
