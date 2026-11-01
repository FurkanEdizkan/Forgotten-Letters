<script lang="ts">
	import { m } from '#lib/messages';
	import { elementHref, warbandHref } from '#lib/rules/text';
	import Armoury from '#lib/ui/rules/Armoury.svelte';
	import RuleText from '#lib/ui/rules/RuleText.svelte';
	import UnitCard from '#lib/ui/rules/UnitCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(data.faction);
	const v = $derived(data.variant);
	const title = $derived(f?.faction.name ?? v?.variant.name ?? '');
	const units = $derived(f?.units ?? v?.units ?? []);
	const armoury = $derived(f?.armoury ?? v?.armoury ?? []);
	const upgrades = $derived(f?.upgrades ?? v?.upgrades ?? []);
</script>

<svelte:head><title>{title} · {m.rules.title} · {m.app.name}</title></svelte:head>

{#snippet refs(label: string, list: { id: string; name: string }[], to = elementHref)}
	{#if list.length}
		<p>
			<span class="label">{label}</span>
			{#each list as r, i (r.id)}{i ? ', ' : ' '}<a href={to(data.set, r.id)}>{r.name}</a>{/each}
		</p>
	{/if}
{/snippet}

<header>
	<h1>{title}</h1>
	{#if f}
		<p class="dim">
			{[
				f.faction.alignment,
				m.rules.start(f.faction.startDucats, f.faction.startGlory),
				f.faction.fireteams ? m.rules.fireteams(f.faction.fireteams) : null
			]
				.filter(Boolean)
				.join(' · ')}
		</p>
	{:else if v}
		<p class="dim">
			{m.rules.variantOf} <a href={warbandHref(data.set, v.faction.id)}>{v.faction.name}</a>
		</p>
	{/if}
</header>

<RuleText body={f?.faction.text ?? v?.variant.text} />

{#if f}
	{@render refs(m.rules.variants, f.variants, warbandHref)}
	{@render refs(m.rules.patrons, f.patrons)}
	{@render refs(m.rules.mercenaries, f.mercenaries)}
{:else if v}
	{#if v.replaces.length}
		<p>
			<span class="label">{m.rules.replacesHeading}</span>
			{#each v.replaces as r, i (r.from.id)}{i ? ', ' : ' '}<a
					href={elementHref(data.set, r.from.id)}>{r.from.name}</a
				>
				→ <a href={elementHref(data.set, r.to.id)}>{r.to.name}</a>{/each}
		</p>
	{/if}
	{@render refs(m.rules.addsHeading, v.adds)}
	{@render refs(m.rules.excludesHeading, v.excludes)}
{/if}

{#if units.length}
	<h2>{m.rules.units}</h2>
	<div class="grid">
		{#each units as u (u.id)}<UnitCard unit={u} />{/each}
	</div>
{/if}

{#if armoury.length}
	<h2>{m.rules.armoury}</h2>
	<Armoury groups={armoury} />
{/if}

{#if upgrades.length}
	<h2>{m.rules.upgrades}</h2>
	<table class="table">
		<tbody>
			{#each upgrades as u (u.id)}
				<tr>
					<td><a href={elementHref(data.set, u.id)}>{u.name}</a></td>
					<td class="num">{m.rules.price(u.cost, u.currency)}</td>
					<td><RuleText body={u.text} /></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	header {
		display: grid;
		gap: var(--space-1);
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	p a,
	td a {
		color: var(--blood-pale);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
		gap: var(--space-3);
	}
</style>
