<!--
  /warbands/[id]/play: play mode, for the table. A read-only card per fighter on the roster: name and entry, stats,
  keywords with their pop-ups (dashed when they come from kit, a grant or a fireteam), every weapon with its full
  profile (type, range, keywords), other kit, abilities, skills and injuries. No money and no edit controls. The
  same page prints (the app's bars are left out).
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import { setRulesView } from '#lib/ui/rules/context';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import KeywordChip from '#lib/ui/rules/KeywordChip.svelte';
	import StatBox from '#lib/ui/warbands/StatBox.svelte';
	import RulesPeek from '#lib/ui/rules/RulesPeek.svelte';
	import { isActive } from '#lib/warbands/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const b = m.warbands.builder;
	const p = m.warbands.play;
	const STATS = ['movement', 'ranged', 'melee', 'armour'] as const;
	setRulesView({
		get set() {
			return data.set;
		},
		get names() {
			return data.names;
		},
		get keywords() {
			return data.keywords;
		}
	});
	const wb = $derived(data.warband);
	const on = $derived(wb.fighters.filter((x) => isActive(x)));
	const weapon = (c: string) => c === 'ranged' || c === 'melee' || c === 'grenade';
</script>

<!-- Rules cards over the page: links to items, units and keywords open here instead of the docs. -->
<RulesPeek />

<svelte:head><title>{wb.name} · {p.title} · {m.app.name}</title></svelte:head>

<header class="head">
	<div>
		<h1>{wb.name}</h1>
		<p class="dim">
			{[wb.variantName ?? wb.dedicationName, wb.factionName].filter(Boolean).join(' · ')}
			{#if wb.patronName}· {b.patron}: {wb.patronName}{/if}
		</p>
	</div>
	<div class="tools">
		<Button href="/warbands/{wb.id}">{p.back}</Button>
		<Button onclick={() => window.print()}>{p.print}</Button>
	</div>
</header>

{#if !on.length}
	<EmptyState text={p.empty} />
{/if}

<div class="play">
	{#each on as x (x.id)}
		{@const unit = data.units[x.unitId]}
		<article class="pc" data-play={x.id}>
			<header class="pnh">
				<h2>{x.name ?? x.unitName}</h2>
				{#if x.name}<span>{x.unitName}</span>{/if}
				{#if x.status !== 'active'}<span class="st">{b.statuses[x.status]}</span>{/if}
			</header>
			{#if unit}
				<!-- The fighter's own profile with what changes it, as on its card: green better, red worse. -->
				<div class="stats">
					{#each STATS as s (s)}<StatBox
							label={m.rules.stats[s]}
							value={x.stats[s]}
							change={x.statChanges.find((c) => c.stat === s)}
						/>{/each}
					{#if x.stats.base}<StatBox label={m.rules.stats.base} value={x.stats.base} />{/if}
				</div>
			{/if}
			{#if x.keywords.length}
				<p class="chips">
					{#each x.keywords as k, i (`${i}:${k.kw}:${k.value ?? ''}`)}<KeywordChip
							id={k.kw}
							label={k.value != null ? null : k.name}
							value={k.value}
							from={k.derived ? k.from : undefined}
						/>{/each}
				</p>
			{/if}
			{#each x.kit.filter((k) => weapon(k.category)) as k, i (`${i}:${k.itemId}`)}
				{@const item = data.items[k.itemId]}
				<div class="wp">
					<b>{k.name}</b>
					<span class="data">{item?.type ?? ''}{item?.range ? ` · ${item.range}` : ''}</span>
					{#if item?.keywords.length}
						<p class="chips">
							{#each item.keywords as kw, j (`${j}:${kw.kw}`)}<KeywordChip
									id={kw.kw}
									value={kw.value}
								/>{/each}
						</p>
					{/if}
				</div>
			{/each}
			{#if x.kit.some((k) => !weapon(k.category))}
				<p class="kit">
					<span>{p.otherKit}</span>
					{x.kit
						.filter((k) => !weapon(k.category))
						.map((k) => k.name)
						.join(', ')}
				</p>
			{/if}
			{#if x.upgrades.length}<p class="kit">
					<span>{b.upgrades}</span>
					{x.upgrades.map((u) => u.name).join(', ')}
				</p>{/if}
			{#if x.skills.length}<p class="kit">
					<span>{b.advancements}</span>
					{x.skills.map((s) => s.name).join(', ')}
				</p>{/if}
			{#if x.injuries.length}<p class="kit">
					<span>{b.injuries}</span>
					{x.injuries.map((s) => s.name).join(', ')}
				</p>{/if}
			{#if unit?.abilities.length}
				<details class="ab" open>
					<summary>{b.abilities}</summary>
					{#each unit.abilities as a (a.name)}<p><b>{a.name}.</b> {a.text}</p>{/each}
				</details>
			{/if}
		</article>
	{/each}
</div>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-4);
		align-items: flex-start;
	}
	.head h1,
	.head p {
		margin: 0;
	}
	.tools {
		display: flex;
		gap: var(--space-2);
	}
	.play {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.pc {
		display: grid;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		break-inside: avoid;
	}
	.pc > :not(.pnh) {
		margin-inline: var(--space-3);
	}
	.pnh {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		padding: var(--space-2) var(--space-3);
		background: var(--blood);
	}
	.pnh h2 {
		margin: 0;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-title);
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
	}
	.pnh span {
		color: var(--bone-dim);
	}
	.st {
		margin-left: auto;
		color: var(--warn) !important;
	}
	.stats {
		display: flex;
		gap: var(--space-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
	}
	.wp {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px var(--space-3);
		padding-top: var(--space-2);
		border-top: var(--border-hairline) solid var(--rule);
	}
	.wp .chips {
		grid-column: 1 / -1;
	}
	.wp span {
		color: var(--bone-dim);
	}
	.kit {
		margin: 0;
	}
	.kit span {
		margin-right: var(--space-2);
		color: var(--bone-faint);
	}
	.ab p {
		margin: var(--space-1) 0;
		color: var(--bone-dim);
	}
	summary {
		cursor: pointer;
		color: var(--bone-faint);
	}
	@media print {
		:global(.shell > :not(.body)),
		:global(.body > :not(main)),
		.tools {
			display: none !important;
		}
		:global(body),
		.pc,
		.pnh {
			background: #fff !important;
			color: #000 !important;
		}
		.pc {
			border-color: #000;
		}
		.play {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
