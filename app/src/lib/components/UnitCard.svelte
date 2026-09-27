<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { RosterUnit } from '$lib/roster';

	let {
		unit,
		photo = null,
		selected = false,
		compact = false,
		onclick,
		actions
	}: {
		unit: RosterUnit;
		photo?: string | null;
		selected?: boolean;
		compact?: boolean;
		onclick?: () => void;
		actions?: Snippet;
	} = $props();

	const KIND_ICON = { ranged: '➶', melee: '⚔', armour: '⛨', equipment: '✦' } as const;
	const stats = $derived(
		(['movement', 'ranged', 'melee', 'armour', 'base'] as const)
			.map((k) => [k, unit.stats?.[k]] as const)
			.filter(([, v]) => v)
	);
	const LABEL = { movement: 'Mv', ranged: 'Rg', melee: 'Ml', armour: 'Ar', base: 'Base' } as const;
	const initials = $derived(unit.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''));
</script>

<article class="card cat-{unit.category}" class:selected class:dead={unit.status !== 'active'} class:compact>
	<button type="button" class="face" {onclick} disabled={!onclick}>
		<span class="photo">
			{#if photo}<img src={photo} alt="" />{:else}<span>{initials}</span>{/if}
		</span>
		<span class="head">
			<strong>{#if unit.leader}<span class="leader" title="Leader">♛</span>{/if}{unit.name}</strong>
			<small>
				{unit.type || '—'} · {unit.category === 'elite' ? 'Elite' : unit.category === 'mercenary' ? 'Mercenary' : 'Troop'}
				{#if unit.status !== 'active'} · <em>{unit.status}</em>{/if}
			</small>
		</span>
		<span class="cost {unit.currency}">{unit.cost}<small>{unit.currency === 'glory' ? '☼' : 'D'}</small></span>
	</button>

	{#if stats.length && !compact}
		<div class="stats">
			{#each stats as [k, v] (k)}<span><small>{LABEL[k]}</small>{v}</span>{/each}
		</div>
	{/if}

	{#if unit.equipment.length}
		<div class="chips">
			{#each unit.equipment as e, i (i)}
				<span class="chip {e.kind}" title="{e.cost} {e.currency}"><i>{KIND_ICON[e.kind]}</i>{e.name}</span>
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
	.card {
		display: grid;
		gap: 6px;
		padding: 8px 10px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-left: 4px solid var(--rule);
	}
	.cat-elite {
		border-left-color: var(--blood);
	}
	.cat-mercenary {
		border-left-color: var(--territories);
	}
	.card.selected {
		box-shadow: 0 0 0 2px var(--blood);
	}
	.card.dead {
		opacity: 0.55;
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
		font-variant-caps: normal;
		letter-spacing: 0;
	}
	.face:disabled {
		cursor: default;
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
		border-radius: 4px;
		background: var(--parchment);
		border: 1px solid var(--rule);
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
	.head small {
		color: var(--muted);
	}
	.leader {
		color: var(--favour);
		margin-right: 4px;
	}
	.cost {
		font-weight: 700;
		font-size: 1.1rem;
		white-space: nowrap;
	}
	.cost small {
		font-size: 0.7em;
		margin-left: 1px;
		color: var(--muted);
	}
	.cost.glory {
		color: var(--favour);
	}
	.stats {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.stats span {
		display: grid;
		text-align: center;
		min-width: 2.6rem;
		padding: 1px 4px;
		background: var(--ink);
		color: var(--parchment);
		font-weight: 700;
		line-height: 1.1;
	}
	.stats small {
		font-size: 0.6rem;
		font-weight: 400;
		color: var(--rule);
		font-variant-caps: small-caps;
	}
	.chips,
	.traits {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		padding: 1px 7px;
		font-size: 0.85rem;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	.chip i {
		font-style: normal;
		color: var(--muted);
	}
	.chip.ranged i {
		color: var(--territories);
	}
	.chip.melee i {
		color: var(--relics);
	}
	.chip.armour i {
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
	}
	.traits span {
		padding: 0 6px;
		font-size: 0.82rem;
		border-radius: 8px;
	}
	.skill {
		background: #efe0b8;
		color: #6b4a0e;
	}
	.up {
		background: #dce6d2;
		color: #34511b;
	}
	.scar {
		background: #f0d6cf;
		color: var(--relics);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
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
