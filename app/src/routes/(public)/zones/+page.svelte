<script lang="ts">
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import type { Zone } from '$lib/rules/types';
	import Mark from '$lib/components/Mark.svelte';

	let { data } = $props();

	const live = getLive();
	const s = $derived(live.current);
	const zones = $derived([...buildGraph(s.campaign.houseZones).zones.values()].sort((a, b) => a.name.localeCompare(b.name)));
	const groups = $derived([
		{ title: 'Entry Zones', zones: zones.filter((z) => z.type === 'entry') },
		{ title: 'Special Zones', zones: zones.filter((z) => z.type === 'special') },
		{ title: 'Zones', zones: zones.filter((z) => z.type === 'basic') }
	]);
	const outposts = (z: Zone) => s.warbands.filter((w) => w.outposts.includes(z.id)).length;
	const battle = (z: Zone) => s.active.some((g) => g.zone === z.id);
</script>

<svelte:head><title>Zones · {s.campaign.name}</title></svelte:head>

<main>
	<h1>The Carcass Front</h1>
	<p class="lede">Every place on the map, with its lore and resources.</p>
	{#each groups as g (g.title)}
		<h2>{g.title}</h2>
		<ul>
			{#each g.zones as z (z.id)}
				<li>
					<a href="/zones/{z.id}">
						<span class="name">
							<strong>{z.name}</strong>
							{#each z.resources as r (r)}<span class="dot res-{r}" title={r}>{r}</span>{/each}
							{#if battle(z)}<span class="tag"><Mark name="swords" /> battle</span>{/if}
							{#if outposts(z)}<span class="tag muted" title="Outposts"><Mark name="pennant" /> {outposts(z)}</span>{/if}
						</span>
						{#if data.excerpts[z.id]}<small>{data.excerpts[z.id]}</small>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/each}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.lede {
		margin: 0 0 8px;
		color: var(--ink-soft);
	}
	/* A gazetteer: entries in columns, ruled apart, no boxes. */
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		column-gap: 32px;
		border-top: 2px solid var(--ink);
	}
	a {
		display: grid;
		gap: 2px;
		height: 100%;
		padding: 10px 2px 12px;
		border-bottom: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	a:hover strong {
		color: var(--blood);
	}
	.name {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	strong {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		transition: color 0.18s var(--ease-out);
	}
	.dot {
		display: inline-grid;
		place-items: center;
		width: 1.35em;
		height: 1.35em;
		border-radius: 50%;
		border: 1.5px solid var(--ink);
		color: #fff;
		font-size: 0.72rem;
		font-weight: 700;
	}
	.res-F {
		background: var(--favour);
	}
	.res-R {
		background: var(--relics);
	}
	.res-S {
		background: var(--supplies);
	}
	.res-T {
		background: var(--territories);
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--blood);
	}
	small {
		font-style: italic;
		line-height: 1.4;
	}
	small,
	.muted {
		color: var(--muted);
	}
</style>
