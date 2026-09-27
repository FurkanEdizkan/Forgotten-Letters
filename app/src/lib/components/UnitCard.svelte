<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { RosterUnit } from '$lib/roster';
	import { invalidateAll } from '$app/navigation';
	import Mark from './Mark.svelte';

	let {
		unit,
		photo = null,
		art = null,
		editable = false,
		unitId = null,
		selected = false,
		compact = false,
		onclick,
		actions
	}: {
		unit: RosterUnit;
		/** The unit's own picture. */
		photo?: string | null;
		/** Its type's default picture. */
		art?: string | null;
		/** Show the picture controls (the unit's player, or the Campaign Master). */
		editable?: boolean;
		unitId?: string | null;
		selected?: boolean;
		compact?: boolean;
		onclick?: () => void;
		actions?: Snippet;
	} = $props();

	const stats = $derived(
		(['movement', 'ranged', 'melee', 'armour', 'base'] as const)
			.map((k) => [k, unit.stats?.[k]] as const)
			.filter(([, v]) => v)
	);
	const LABEL = { movement: 'Movement', ranged: 'Ranged', melee: 'Melee', armour: 'Armour', base: 'Base' } as const;
	const initials = $derived(unit.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''));
	const picture = $derived(photo ?? art);
	const rank = $derived(unit.leader ? 'Leader' : unit.category === 'elite' ? 'Elite' : unit.category === 'mercenary' ? 'Mercenary' : null);
	let busy = $state(false);
	let problem = $state('');

	async function send(body: FormData) {
		if (!unitId) return;
		busy = true;
		problem = '';
		const res = await fetch(`/api/unit-photo/${unitId}`, { method: 'POST', body });
		busy = false;
		if (!res.ok) problem = (await res.text().catch(() => '')) || 'Could not change the picture.';
		else await invalidateAll();
	}
	function upload(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		const body = new FormData();
		body.set('image', f);
		send(body);
	}
	function useDefault() {
		const body = new FormData();
		body.set('clear', '1');
		send(body);
	}
</script>

<article class="card cat-{unit.category}" class:selected class:dead={unit.status !== 'active'} class:compact>
	{#if !compact}
		<div class="art">
			{#if picture}
				<img src={picture} alt="{unit.name}, {unit.type || 'model'}" loading="lazy" />
			{:else}
				<span class="blank" aria-hidden="true">{initials}</span>
			{/if}
			{#if rank}<span class="ribbon">{rank}</span>{/if}
			<span class="medal {unit.currency}" title="{unit.cost} {unit.currency}">{unit.cost}<small>{unit.currency === 'glory' ? 'G' : 'D'}</small></span>
			{#if editable && unitId}
				<div class="pic-tools">
					<label class="pic-btn">
						{busy ? 'Saving…' : picture ? 'Change picture' : 'Add picture'}
						<input type="file" accept="image/png,image/jpeg,image/webp" onchange={upload} disabled={busy} />
					</label>
					{#if photo}<button type="button" class="pic-btn" onclick={useDefault} disabled={busy}>{art ? 'Use default' : 'Remove'}</button>{/if}
				</div>
			{/if}
		</div>
		{#if problem}<small class="problem">{problem}</small>{/if}
	{/if}
	<button type="button" class="face" {onclick} disabled={!onclick}>
		{#if compact}
			<span class="photo">
				{#if picture}<img src={picture} alt="" />{:else}<span>{initials}</span>{/if}
			</span>
		{/if}
		<span class="head">
			<strong>{unit.name}</strong>
			<small>
				{#if compact && unit.leader}<span class="leader">Leader</span>{' · '}{/if}{#if unit.type && (compact || unit.type !== unit.name)}{unit.type}{' · '}{/if}{unit.category === 'elite' ? 'Elite' : unit.category === 'mercenary' ? 'Mercenary' : 'Troop'}
				{#if unit.status !== 'active'} · <em>{unit.status}</em>{/if}
			</small>
		</span>
		{#if compact}<span class="cost {unit.currency}">{unit.cost}<small>{unit.currency === 'glory' ? 'Glory' : 'Ducats'}</small></span>{/if}
	</button>

	{#if stats.length && !compact}
		<table class="stats">
			<thead><tr>{#each stats as [k] (k)}<th>{LABEL[k]}</th>{/each}</tr></thead>
			<tbody><tr>{#each stats as [k, v] (k)}<td>{v}</td>{/each}</tr></tbody>
		</table>
	{/if}

	{#if unit.equipment.length}
		<div class="chips">
			{#each unit.equipment as e, i (i)}
				<span class="chip {e.kind}" title="{e.kind} · {e.cost} {e.currency}"><Mark name={e.kind} />{e.name}</span>
			{/each}
		</div>
	{/if}

	{#if unit.category !== 'troop' || unit.experience}
		<div class="xp" title="{unit.experience} experience">
			{#each Array(Math.min(20, Math.max(unit.experience, 10))) as _, i (i)}<span class:on={i < unit.experience}></span>{/each}
			<small>{unit.experience} XP</small>
		</div>
	{/if}

	{#if unit.skills.length || unit.injuries.length || unit.upgrades.length}
		<div class="traits">
			{#each unit.upgrades as u (u)}<span class="up">{u}</span>{/each}
			{#each unit.skills as s (s)}<span class="skill">{s}</span>{/each}
			{#each unit.injuries as s (s)}<span class="scar">{s}</span>{/each}
		</div>
	{/if}

	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</article>

<style>
	/* A unit entry from the book's faction lists: name and cost over a rule, profile table, kit. */
	.card {
		display: grid;
		gap: 8px;
		align-content: start;
		padding: 10px 12px 12px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 2px solid var(--ink);
	}
	.cat-elite {
		border-top-color: var(--blood);
	}
	.card.selected {
		border-color: var(--blood);
		box-shadow: 0 0 0 1px var(--blood);
	}
	.card.dead {
		opacity: 0.55;
	}
	.card.dead strong {
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}
	.face {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0;
		background: none;
		border: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1rem;
		text-transform: none;
		letter-spacing: 0;
	}
	.face:hover:not(:disabled) {
		background: none;
		color: inherit;
	}
	.face:disabled,
	.face:disabled:hover {
		cursor: default;
		background: none;
		color: inherit;
	}
	.face:hover:not(:disabled) strong {
		color: var(--blood);
	}
	.photo {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: none;
		background: var(--parchment);
		border: 1px solid var(--ink);
		overflow: hidden;
		font-family: var(--font-display);
		color: var(--blood);
	}
	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.head {
		display: grid;
		flex: 1;
		min-width: 0;
		line-height: 1.2;
	}
	.head strong {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		transition: color 0.18s var(--ease-out);
	}
	.head small {
		color: var(--muted);
	}
	.leader {
		color: var(--blood);
		font-weight: 700;
	}
	.cost {
		display: grid;
		justify-items: end;
		font-weight: 700;
		font-size: 1.15rem;
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: lining-nums;
	}
	.cost small {
		font-size: 0.62rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.cost.glory {
		color: var(--favour);
	}
	.stats {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		text-align: center;
	}
	.stats th {
		padding: 2px 4px;
		background: var(--wash-deep);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.stats td {
		padding: 2px 4px;
		border-bottom: 1px solid var(--ink);
		font-weight: 600;
	}
	.chips,
	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.chip {
		display: inline-flex;
		gap: 5px;
		align-items: center;
		font-size: 0.9rem;
	}
	.chip :global(.mark) {
		color: var(--muted);
	}
	.chip.ranged :global(.mark) {
		color: var(--territories);
	}
	.chip.melee :global(.mark) {
		color: var(--relics);
	}
	.chip.armour :global(.mark) {
		color: var(--supplies);
	}
	.xp {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
	}
	.xp span {
		width: 9px;
		height: 9px;
		border: 1px solid var(--ink);
		transform: rotate(45deg);
		margin: 0 2px;
	}
	.xp span.on {
		background: var(--blood);
		border-color: var(--blood);
	}
	.xp small {
		margin-left: 6px;
		color: var(--muted);
		font-variant-numeric: lining-nums;
	}
	.traits span {
		font-size: 0.85rem;
		font-style: italic;
	}
	.traits span + span::before {
		content: '· ';
		color: var(--muted);
		font-style: normal;
	}
	.skill {
		color: #6b4a0e;
	}
	.up {
		color: #34511b;
	}
	.scar {
		color: var(--relics);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	/* The card: the unit's picture above its book entry. */
	.card:not(.compact) {
		padding: 0 0 12px;
		overflow: hidden;
	}
	.card:not(.compact) > :not(.art) {
		margin-inline: 12px;
	}
	.art {
		position: relative;
		aspect-ratio: 4 / 3;
		background: radial-gradient(circle at 50% 40%, #2a261d, var(--night) 75%);
		border-bottom: 1px solid var(--ink);
		overflow: hidden;
	}
	.art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 25%;
		display: block;
	}
	.blank {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: 3.4rem;
		color: var(--bone-dim);
	}
	.ribbon {
		position: absolute;
		top: 10px;
		left: 0;
		padding: 2px 10px 2px 8px;
		background: var(--blood);
		color: var(--paper);
		font-weight: 700;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.cat-mercenary .ribbon {
		background: var(--territories);
	}
	.medal {
		position: absolute;
		top: 8px;
		right: 8px;
		display: grid;
		place-items: center;
		align-content: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: var(--paper);
		border: 2px solid var(--ink);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
		font-weight: 700;
		font-size: 1.05rem;
		line-height: 1;
		font-variant-numeric: lining-nums;
	}
	.medal small {
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.medal.glory {
		color: var(--favour);
	}
	.pic-tools {
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 8px;
		display: flex;
		gap: 6px;
		opacity: 0;
		transition: opacity 0.18s var(--ease-out);
	}
	.art:hover .pic-tools,
	.art:focus-within .pic-tools {
		opacity: 1;
	}
	@media (hover: none) {
		.pic-tools {
			opacity: 1;
		}
	}
	.pic-btn {
		position: relative;
		padding: 4px 10px;
		background: rgba(21, 19, 14, 0.85);
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.4);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		cursor: pointer;
	}
	.pic-btn:hover {
		background: rgba(21, 19, 14, 0.95);
		border-color: var(--ember);
		color: #fff;
	}
	.pic-btn input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.problem {
		color: var(--blood);
	}
	.compact {
		padding: 6px 8px;
		gap: 4px;
	}
	.compact .photo {
		width: 34px;
		height: 34px;
	}
</style>
