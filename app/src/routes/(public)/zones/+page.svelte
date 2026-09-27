<script lang="ts">
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import type { Zone } from '$lib/rules/types';

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
	{#each groups as g (g.title)}
		<h2>{g.title}</h2>
		<ul>
			{#each g.zones as z (z.id)}
				<li>
					<a href="/zones/{z.id}">
						<span class="name">
							<strong>{z.name}</strong>
							{#each z.resources as r (r)}<span class="dot res-{r}" title={r}>{r}</span>{/each}
							{#if battle(z)}<span class="tag">battle</span>{/if}
							{#if outposts(z)}<span class="tag muted">{outposts(z)} ⚑</span>{/if}
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
		max-width: 60rem;
		margin: 0 auto;
		padding: 16px 16px 60px;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 6px;
	}
	a {
		display: grid;
		gap: 2px;
		height: 100%;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	a:hover {
		border-color: var(--blood);
	}
	.name {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.dot {
		display: inline-grid;
		place-items: center;
		width: 1.3em;
		height: 1.3em;
		border-radius: 50%;
		color: var(--paper);
		font-size: 0.75rem;
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
		font-size: 0.8rem;
		font-variant-caps: small-caps;
		color: var(--blood);
	}
	small,
	.muted {
		color: var(--muted);
	}
</style>
